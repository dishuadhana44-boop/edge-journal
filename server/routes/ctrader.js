import express from "express";
import process from "node:process";

import {
  startCTraderService,
  stopCTraderService,
  placeMarketOrder,
  closePosition,
  amendPositionSLTP,
  getOpenPositions,
  resolvePositionSymbolId,
  getAvailableSymbols,
  resolveOrderSymbolTarget,
  getCTraderServiceStatus,
  buildExecutionBroadcastMessage,
} from "../services/ctraderService.js";

import { broadcast } from "../services/websocketService.js";

import {
  normalizeAccountKey,
  planAccountRemoval,
  selectAccountById,
  verifySessionAccountIdentity,
} from "../services/ctraderAccountSelection.js";

import { createCtraderStore } from "../services/ctraderStore.js";
import { migrateLegacyAccounts } from "../services/ctraderAccountMigration.js";

import { AUTH_FILE } from "../runtimePaths.js";

const router = express.Router();

const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5174";

// ============================================================
// cTRADER AUTH + MULTI ACCOUNT STATE
// ============================================================

let ctraderAuth = {
  connected: false,
  accessToken: null,
  refreshToken: null,
  expiresIn: null,
  accounts: [],
  activeAccountId: null,
};

// ============================================================
// PERSISTENCE
// ============================================================

/* Reading, writing and deleting the saved session lives in
   services/ctraderStore.js. The route keeps the in-memory state and
   names the file it came from, which is what lets a test point the
   same storage code at a temporary directory.

   A handler that changes the saved session writes before it adopts:
   it builds the whole next state, persists that, and only then makes
   it the module's state. If the store refuses, the throw reaches the
   handler's own catch, the response says so, and the state in memory
   is still the state on disk. The order is the point — a handler
   that updated ctraderAuth first would go on telling the rest of the
   process about a session nobody persisted, and the next boot would
   load a different one. */

const authStore = createCtraderStore({ filePath: AUTH_FILE });

// ============================================================
// LOAD SAVED AUTH
// ============================================================

function loadSavedAuth() {
  const saved = authStore.load();

  // A file that is missing or unreadable leaves the state the route
  // started with, exactly as the inline loader did.
  if (saved !== null) {
    ctraderAuth = saved;
  }
}

// ============================================================
// SAVE A STATE THAT HAS NOT ADOPTED ANYTHING YET
// ============================================================

function saveAuth(state) {
  authStore.save(state);
}

// ============================================================
// CLEAR SAVED AUTH
// ============================================================

function clearSavedAuth() {
  authStore.clear();
}

// ============================================================
// GET ACTIVE ACCOUNT
// ============================================================

function getActiveAccount() {
  if (!ctraderAuth.activeAccountId) {
    return null;
  }

  return (
    ctraderAuth.accounts.find(
      (account) =>
        String(account.accountId) ===
        String(ctraderAuth.activeAccountId)
    ) || null
  );
}

// ============================================================
// LOAD AUTH ON SERVER START
// ============================================================

migrateLegacyAccounts();
loadSavedAuth();

// ============================================================
// LIVE PRICE STORAGE
// ============================================================

const livePrices = new Map();

// ============================================================
// BROADCAST LIVE PRICE
// ============================================================

function broadcastLivePrice(price) {
  if (!price) return;

  const symbol = String(price.symbol || "EURUSD")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (!livePrices.has(symbol)) {
    livePrices.set(symbol, {
      bid: null,
      ask: null,
    });
  }

  const storedPrice = livePrices.get(symbol);

  const incomingBid = Number(price.bid);
  const incomingAsk = Number(price.ask);

  if (
    Number.isFinite(incomingBid) &&
    incomingBid > 0
  ) {
    storedPrice.bid = incomingBid;
  }

  if (
    Number.isFinite(incomingAsk) &&
    incomingAsk > 0
  ) {
    storedPrice.ask = incomingAsk;
  }

  // Wait until both bid and ask exist
  if (
    storedPrice.bid === null ||
    storedPrice.ask === null
  ) {
    return;
  }

  const message = {
    type: "price",
    symbol,
    symbolId: price.symbolId || null,
    bid: storedPrice.bid,
    ask: storedPrice.ask,
    timestamp: price.timestamp || Date.now(),
  };

  const clientsReached = broadcast(message);

  console.log(
    `📤 LIVE PRICE → ${symbol} | BID: ${storedPrice.bid} | ASK: ${storedPrice.ask} | Clients: ${clientsReached}`
  );
}

// ============================================================
// BROADCAST EXECUTION EVENT
// ============================================================

function broadcastExecution(execution) {
  if (!execution) return;

  const message =
    buildExecutionBroadcastMessage(execution);

  const clientsReached = broadcast(message);

  console.log(
    `📤 Execution broadcast to ${clientsReached} frontend client(s)`
  );
}

// ============================================================
// TRADING ENDPOINT ACCOUNT IDENTITY
// ============================================================

/* A trading request is the one place where being wrong about the
   account costs money, so it has to prove all three identities before
   a single frame is forwarded:

     1. an account is selected and the selection is a usable id;
     2. that exact account is one of the saved authorized accounts;
     3. the ready service session belongs to that exact account.

   Each proof is the same shared rule the service and the selection
   routes already use, so the three of them cannot drift into agreeing
   with different accounts. A refusal changes nothing: it does not
   start, stop or replace a session, does not pick a different account,
   and does not persist anything.

   The service has to already be authenticated and ready. A trading
   endpoint no longer brings a session up on the way to a trade,
   because "start a session for the account in the file" is exactly the
   decision this rule exists to refuse when the file and the session
   disagree. POST /start-service still brings the session up, and the
   identity proofs there are the service's own. */
function tradingEndpointIdentity() {
  const selection = selectAccountById({
    accountIds: (
      Array.isArray(ctraderAuth.accounts) ? ctraderAuth.accounts : []
    ).map((account) => account?.accountId),

    requestedAccountId: ctraderAuth.activeAccountId,
  });

  if (!selection.ok) {
    /* Nothing usable was ever asked for, which is the caller's
       question to answer; a request that named an account and was
       refused is a disagreement inside this process. */
    const nothingSelected =
      normalizeAccountKey(ctraderAuth.activeAccountId) === null;

    return {
      ok: false,
      status: nothingSelected ? 400 : 409,
      code: selection.code,
      message: selection.message,
    };
  }

  const status = getCTraderServiceStatus();

  if (
    !status.running ||
    !status.connected ||
    !status.authenticated ||
    !status.ready
  ) {
    return {
      ok: false,
      status: 409,
      code: "service_not_ready",
      message:
        "The cTrader trading service is not authenticated and ready, so the request was not forwarded.",
    };
  }

  const session = verifySessionAccountIdentity({
    requestedAccountId: selection.accountId,
    sessionId: status.tradingAccountId,
  });

  if (!session.ok) {
    return {
      ok: false,
      status: 409,
      code: session.code,
      message: session.message,
    };
  }

  return {
    ok: true,
    accountId: selection.accountId,
  };
}

// ============================================================
// START cTRADER SERVICE
// ============================================================

/* A service that reports itself ready is only usable by this route if
   it is ready for the account the route asked for. The route holds the
   selected account, the service holds the session, and only the shared
   rule may say whether they are the same account. */
function verifiedReadyStatus(status) {
  const verification = verifySessionAccountIdentity({
    requestedAccountId: ctraderAuth.activeAccountId,
    sessionId: status.tradingAccountId,
  });

  if (!verification.ok) {
    throw new Error(verification.message);
  }

  return status;
}

async function startService() {
  if (
    !ctraderAuth.connected ||
    !ctraderAuth.accessToken
  ) {
    throw new Error(
      "cTrader OAuth is not connected. Please connect your cTrader account first."
    );
  }

  if (!ctraderAuth.activeAccountId) {
    throw new Error(
      "No active cTrader account selected."
    );
  }

  const activeAccount = getActiveAccount();

  if (!activeAccount) {
    throw new Error(
      "Active account was not found in saved accounts."
    );
  }

  const currentStatus = getCTraderServiceStatus();

  // Service already ready
  if (
    currentStatus.running &&
    currentStatus.connected &&
    currentStatus.authenticated &&
    currentStatus.ready
  ) {
    console.log(
      "✅ cTrader service is already running."
    );

    return verifiedReadyStatus(currentStatus);
  }

  console.log("");
  console.log("====================================");
  console.log("🚀 STARTING cTRADER SERVICE");
  console.log("====================================");

  console.log({
    hasAccessToken: Boolean(
      ctraderAuth.accessToken
    ),
    activeAccountId:
      ctraderAuth.activeAccountId,
    accountName: activeAccount.name,
  });

  const result = await startCTraderService(
    // Price callback
    (price) => {
      broadcastLivePrice(price);
    },

    // Execution callback
    (execution) => {
      broadcastExecution(execution);
    },

    // Access token
    ctraderAuth.accessToken,

    // Active account ID
    ctraderAuth.activeAccountId
  );

  return result;
}

// ============================================================
// ENSURE SERVICE IS RUNNING
// ============================================================

async function ensureServiceRunning() {
  const status = getCTraderServiceStatus();

  if (
    status.running &&
    status.connected &&
    status.authenticated &&
    status.ready
  ) {
    return verifiedReadyStatus(status);
  }

  console.log(
    "⚠️ Trading service is not ready."
  );

  console.log(
    "🔄 Attempting to start cTrader service..."
  );

  await startService();

  const newStatus = getCTraderServiceStatus();

  if (
    !newStatus.authenticated ||
    !newStatus.ready
  ) {
    throw new Error(
      "cTrader trading service failed to authenticate."
    );
  }

  return verifiedReadyStatus(newStatus);
}

// ============================================================
// cTRADER CONNECT
// ============================================================

router.get("/connect", (req, res) => {
  try {
    const clientId =
      process.env.CTRADER_CLIENT_ID;

    const redirectUri =
      process.env.CTRADER_REDIRECT_URI;

    if (!clientId) {
      return res.status(500).json({
        success: false,
        message:
          "CTRADER_CLIENT_ID is missing in .env",
      });
    }

    if (!redirectUri) {
      return res.status(500).json({
        success: false,
        message:
          "CTRADER_REDIRECT_URI is missing in .env",
      });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "trading",
      product: "web",
    });

    const authUrl =
      `https://id.ctrader.com/my/settings/openapi/grantingaccess/?${params.toString()}`;

    console.log("");
    console.log("====================================");
    console.log("🔗 cTrader OAuth URL");
    console.log("====================================");
    console.log(authUrl);
    console.log("====================================");

    return res.redirect(authUrl);
  } catch (error) {
    console.error(
      "❌ cTrader Connect Error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ============================================================
// cTRADER CALLBACK
// ============================================================

router.get("/callback", async (req, res) => {
  try {
    console.log("");
    console.log("====================================");
    console.log("📥 cTrader CALLBACK");
    console.log("====================================");

    const {
      code,
      error,
      description,
    } = req.query;

    // User denied access
    if (error) {
      console.error(
        "❌ cTrader OAuth Error:",
        error,
        description
      );

      const message = encodeURIComponent(
        description ||
          error ||
          "oauth_denied"
      );

      return res.redirect(
        `${FRONTEND_URL}/settings?ctrader=error&message=${message}`
      );
    }

    // No authorization code
    if (!code) {
      return res.redirect(
        `${FRONTEND_URL}/settings?ctrader=error&message=no_code`
      );
    }

    const clientId =
      process.env.CTRADER_CLIENT_ID;

    const clientSecret =
      process.env.CTRADER_CLIENT_SECRET;

    const redirectUri =
      process.env.CTRADER_REDIRECT_URI;

    if (
      !clientId ||
      !clientSecret ||
      !redirectUri
    ) {
      return res.redirect(
        `${FRONTEND_URL}/settings?ctrader=error&message=server_config_missing`
      );
    }

    console.log(
      "🔐 Exchanging cTrader authorization code..."
    );

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokenUrl =
      `https://openapi.ctrader.com/apps/token?${tokenParams.toString()}`;

    const tokenResponse = await fetch(
      tokenUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    let tokenData = {};

    try {
      tokenData = await tokenResponse.json();
    } catch {
      tokenData = {};
    }

    console.log("Token response:", {
      status: tokenResponse.status,
      hasAccessToken:
        Boolean(tokenData.accessToken),
      hasRefreshToken:
        Boolean(tokenData.refreshToken),
      errorCode:
        tokenData.errorCode || null,
      description:
        tokenData.description || null,
    });

    // Token failed
    if (
      !tokenResponse.ok ||
      !tokenData.accessToken
    ) {
      const message = encodeURIComponent(
        tokenData.description ||
          tokenData.errorCode ||
          "token_exchange_failed"
      );

      return res.redirect(
        `${FRONTEND_URL}/settings?ctrader=error&message=${message}`
      );
    }

    // Save authentication
    // Keep existing accounts
    const next = {
      connected: true,

      accessToken:
        tokenData.accessToken,

      refreshToken:
        tokenData.refreshToken || null,

      expiresIn:
        tokenData.expiresIn || null,

      accounts: Array.isArray(
        ctraderAuth.accounts
      )
        ? ctraderAuth.accounts
        : [],

      activeAccountId:
        ctraderAuth.activeAccountId ||
        null,
    };

    saveAuth(next);

    ctraderAuth = next;

    console.log("");
    console.log("====================================");
    console.log(
      "✅ cTRADER OAUTH CONNECTED SUCCESSFULLY"
    );
    console.log("====================================");

    /* Authorization is not selection: only POST /accounts/select may
       activate a trading session. */

    return res.redirect(
      `${FRONTEND_URL}/settings?ctrader=connected`
    );
  } catch (error) {
    console.error(
      "❌ cTrader Callback Error:",
      error.message
    );

    const message = encodeURIComponent(
      error.message ||
        "oauth_callback_failed"
    );

    return res.redirect(
      `${FRONTEND_URL}/settings?ctrader=error&message=${message}`
    );
  }
});

// ============================================================
// STATUS
// ============================================================

router.get("/status", (req, res) => {
  const serviceStatus =
    getCTraderServiceStatus();

  const activeAccount =
    getActiveAccount();

  return res.json({
    success: true,

    connected:
      ctraderAuth.connected,

    hasAccessToken:
      Boolean(ctraderAuth.accessToken),

    hasRefreshToken:
      Boolean(ctraderAuth.refreshToken),

    accounts:
      ctraderAuth.accounts,

    activeAccountId:
      ctraderAuth.activeAccountId,

    activeAccount,

    service: serviceStatus,
  });
});

// ============================================================
// GET ALL SAVED ACCOUNTS
// ============================================================

router.get("/accounts", (req, res) => {
  const activeAccount =
    getActiveAccount();

  return res.json({
    success: true,

    accounts:
      ctraderAuth.accounts,

    activeAccountId:
      ctraderAuth.activeAccountId,

    activeAccount,
  });
});

// ============================================================
// DEBUG
// ============================================================

router.get("/debug", (req, res) => {
  return res.json({
    success: true,

    auth: {
      connected:
        ctraderAuth.connected,

      hasAccessToken:
        Boolean(
          ctraderAuth.accessToken
        ),

      hasRefreshToken:
        Boolean(
          ctraderAuth.refreshToken
        ),

      accounts:
        ctraderAuth.accounts,

      activeAccountId:
        ctraderAuth.activeAccountId,
    },

    activeAccount:
      getActiveAccount(),

    service:
      getCTraderServiceStatus(),
  });
});

// ============================================================
// ADD / SAVE TRADING ACCOUNT (SAVES, NEVER ACTIVATES)
// ============================================================

router.post("/account", async (req, res) => {
  try {
    const {
      accountId,
      accountName,
    } = req.body;

    if (!ctraderAuth.connected) {
      return res.status(401).json({
        success: false,
        message:
          "cTrader OAuth is not connected",
      });
    }

    /* The id of a saved record has to be an id, so it is read through
       the same rule that decides every other cTrader account question.
       A blank, an object, or anything that prints as "[object Object]"
       names no account, and writing one down would leave a record no
       selection can ever ask for. */
    const newAccountId =
      normalizeAccountKey(accountId);

    if (
      newAccountId === null
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Account ID is required",
      });
    }

    const storedAccount =
      ctraderAuth.accounts.find(
        (account) =>
          normalizeAccountKey(account.accountId) ===
          newAccountId
      );

    /* Nothing here is written into the state the route is holding.
       The candidate carries a new array, so a store that refuses the
       write leaves the account list the caller was shown before the
       request as well as the one on disk. */
    let savedAccount;
    let accounts;

    // Add new account
    if (!storedAccount) {
      savedAccount = {
        id:
          `account-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,

        accountId:
          newAccountId,

        name:
          accountName ||
          `Trading Account ${
            ctraderAuth.accounts.length + 1
          }`,

        createdAt:
          new Date().toISOString(),
      };

      accounts = [
        ...ctraderAuth.accounts,
        savedAccount,
      ];

      console.log(
        "➕ New trading account added:",
        savedAccount
      );
    } else {
      savedAccount =
        accountName &&
        String(accountName).trim()
          ? {
              ...storedAccount,

              name:
                String(accountName).trim(),
            }
          : storedAccount;

      accounts =
        ctraderAuth.accounts.map(
          (account) =>
            account === storedAccount
              ? savedAccount
              : account
        );

      console.log(
        "ℹ️ Trading account already exists:",
        savedAccount.accountId
      );
    }

    /* Saving a record and activating an account are different
       decisions, and only one of them is made here. The selection is
       carried over verbatim — including a stored id that names no
       record, which the loader, not this route, decides what to do
       with on the next boot — and no session is stopped, started or
       restarted for an account that has only been written down.
       Activating an account is POST /accounts/select. */
    const next = {
      ...ctraderAuth,

      accounts,

      activeAccountId:
        ctraderAuth.activeAccountId,
    };

    saveAuth(next);

    ctraderAuth = next;

    console.log(
      "✅ Saved cTrader account:",
      savedAccount.accountId
    );

    console.log(
      `ℹ️ No account was activated. Active account: ${
        ctraderAuth.activeAccountId ?? "none"
      }`
    );

    return res.json({
      success: true,

      message:
        "Trading account saved successfully",

      activated:
        false,

      account:
        savedAccount,

      accounts:
        ctraderAuth.accounts,

      activeAccountId:
        ctraderAuth.activeAccountId,
    });
  } catch (error) {
    console.error(
      "❌ Save cTrader account error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ============================================================
// SELECT / SWITCH ACCOUNT (THE ONLY EXPLICIT ACTIVATION)
// ============================================================

router.post(
  "/accounts/select",
  async (req, res) => {
    try {
      const { accountId } = req.body;

      /* What may be activated is decided by the shared rule, so a
         missing, blank or unusable id, and an id that names no saved
         account, are refusals rather than invitations to pick some
         other account. */
      const selection = selectAccountById({
        accountIds: (
          Array.isArray(ctraderAuth.accounts)
            ? ctraderAuth.accounts
            : []
        ).map((account) => account?.accountId),

        requestedAccountId:
          accountId,
      });

      if (!selection.ok) {
        return res
          .status(
            selection.code === "explicit_selection_required"
              ? 400
              : 404
          )
          .json({
            success: false,

            code:
              selection.code,

            message:
              selection.message,
          });
      }

      const selectedAccount =
        ctraderAuth.accounts.find(
          (account) =>
            normalizeAccountKey(account.accountId) ===
            selection.accountId
        );

      const previousAccountId =
        ctraderAuth.activeAccountId;

      const next = {
        ...ctraderAuth,

        activeAccountId:
          selection.accountId,
      };

      saveAuth(next);

      ctraderAuth = next;

      console.log("");
      console.log(
        "===================================="
      );
      console.log(
        "🔄 SWITCHING cTRADER ACCOUNT"
      );
      console.log(
        "===================================="
      );

      console.log({
        from: previousAccountId,
        to: selection.accountId,
        accountName:
          selectedAccount.name,
      });

      // Stop old service
      if (
        normalizeAccountKey(previousAccountId) !==
        selection.accountId
      ) {
        try {
          await stopCTraderService();

          console.log(
            "🛑 Previous cTrader service stopped."
          );
        } catch {
          console.log(
            "⚠️ Previous service was not running."
          );
        }
      }

      /* Bringing the session up is the activation. A write to the
         store is not, so a session this route could not start is
         answered as a failure that says what was saved and what was
         not running. */
      let service;

      try {
        service =
          await startService();
      } catch (error) {
        console.error(
          "❌ Account selected but no session was started:",
          error.message
        );

        return res.status(500).json({
          success: false,

          code:
            "session_not_started",

          message:
            `The account selection was saved, but no cTrader session is active for it: ${error.message}`,
        });
      }

      /* And the session that is up has to be the session for the
         account that was selected — the same identity proof the
         trading endpoints answer with. Without it, "switched" would
         be a claim about a session this process cannot attribute. */
      const identity = verifySessionAccountIdentity({
        requestedAccountId:
          selection.accountId,

        sessionId:
          getCTraderServiceStatus().tradingAccountId,
      });

      if (!identity.ok) {
        console.error(
          "🚫 Account activation refused:",
          identity.message
        );

        return res.status(409).json({
          success: false,

          code:
            identity.code,

          message:
            identity.message,
        });
      }

      return res.json({
        success: true,

        message:
          "Account switched successfully",

        activeAccount:
          selectedAccount,

        activeAccountId:
          selection.accountId,

        service,
      });
    } catch (error) {
      console.error(
        "❌ Account switch error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ============================================================
// DELETE SAVED ACCOUNT
// ============================================================

router.delete(
  "/accounts/:accountId",
  async (req, res) => {
    try {
      const accountId =
        String(
          req.params.accountId
        ).trim();

      const plan = planAccountRemoval({
        accounts: ctraderAuth.accounts,

        activeAccountId:
          ctraderAuth.activeAccountId,

        accountId,
      });

      if (!plan.ok) {
        return res.status(404).json({
          success: false,
          message: "Account not found",
        });
      }

      // Stop service if the removed account was the active one
      if (plan.mustStopService) {
        try {
          await stopCTraderService();
        } catch {
          console.log(
            "⚠️ Service was already stopped."
          );
        }
      }

      /* Removal activates no successor: the accounts left behind were
         never authenticated by the session that was just torn down. */
      const next = {
        ...ctraderAuth,

        accounts: plan.accounts,

        activeAccountId:
          plan.activeAccountId,
      };

      saveAuth(next);

      ctraderAuth = next;

      console.log(
        "🗑️ Trading account removed:",
        plan.removedAccount.accountId
      );

      console.log(`ℹ️ ${plan.message}`);

      return res.json({
        success: true,

        message:
          "Trading account deleted",

        accounts:
          ctraderAuth.accounts,

        activeAccountId:
          ctraderAuth.activeAccountId,
      });
    } catch (error) {
      console.error(
        "❌ Delete account error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ============================================================
// MANUAL START SERVICE
// ============================================================

router.post(
  "/start-service",
  async (req, res) => {
    try {
      const service =
        await ensureServiceRunning();

      return res.json({
        success: true,

        message:
          "cTrader service is ready",

        activeAccount:
          getActiveAccount(),

        service,
      });
    } catch (error) {
      console.error(
        "❌ Start service error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: error.message,

        service:
          getCTraderServiceStatus(),
      });
    }
  }
);

// ============================================================
// PLACE MARKET ORDER
// ============================================================

router.post("/order", async (req, res) => {
  try {
    const {
      symbol,
      side,
      lots,
      stopLoss,
      takeProfit,
      label,
      comment,
    } = req.body;

    if (!ctraderAuth.connected) {
      return res.status(401).json({
        success: false,
        message:
          "cTrader is not connected",
      });
    }

    const identity = tradingEndpointIdentity();

    if (!identity.ok) {
      return res.status(identity.status).json({
        success: false,
        code: identity.code,
        message: identity.message,
      });
    }

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message:
          "Symbol is required",
      });
    }

    if (!side) {
      return res.status(400).json({
        success: false,
        message:
          "Order side is required",
      });
    }

    if (!lots || Number(lots) <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "A valid lot size is required",
      });
    }

    await ensureServiceRunning();

    const target =
      resolveOrderSymbolTarget({
        symbols:
          getAvailableSymbols(),

        symbol,
      });

    if (!target.ok) {
      return res.status(409).json({
        success: false,
        code: target.code,
        message: target.message,
      });
    }

    console.log(
      `📈 Placing order on account: ${ctraderAuth.activeAccountId}`
    );

    const result =
      await placeMarketOrder({
        symbol: target.symbolId,
        side,
        lots,
        stopLoss,
        takeProfit,
        label,
        comment,
      });

    const httpStatus =
      result.status === "accepted"
        ? 200
        : result.status === "rejected"
          ? 409
          : result.status === "unconfirmed"
            ? 504
            : 502;

    return res.status(httpStatus).json({
      ...result,

      success:
        result.status === "accepted",

      activeAccountId:
        ctraderAuth.activeAccountId,
    });
  } catch (error) {
    console.error(
      "❌ PLACE cTRADER ORDER ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: error.message,

      activeAccountId:
        ctraderAuth.activeAccountId,

      service:
        getCTraderServiceStatus(),
    });
  }
});

// ============================================================
// CLOSE POSITION
// ============================================================

router.post(
  "/position/close",
  async (req, res) => {
    try {
      const {
        positionId,
        lots,
      } = req.body;

      if (!ctraderAuth.connected) {
        return res.status(401).json({
          success: false,
          message:
            "cTrader is not connected",
        });
      }

      const identity = tradingEndpointIdentity();

      if (!identity.ok) {
        return res.status(identity.status).json({
          success: false,
          code: identity.code,
          message: identity.message,
        });
      }

      if (!positionId) {
        return res.status(400).json({
          success: false,
          message:
            "Position ID is required",
        });
      }

      await ensureServiceRunning();

      const target =
        resolvePositionSymbolId({
          positions:
            getOpenPositions(),

          positionId,
        });

      if (!target.ok) {
        return res.status(409).json({
          success: false,
          code: target.code,
          message: target.message,
        });
      }

      const result =
        await closePosition({
          positionId:
            target.positionId,

          symbolId:
            target.symbolId,

          lots,
        });

      return res.json(result);
    } catch (error) {
      console.error(
        "❌ Close position error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ============================================================
// MODIFY POSITION STOP LOSS / TAKE PROFIT
// ============================================================

router.post(
  "/position/amend",
  async (req, res) => {
    try {
      const {
        positionId,
        stopLoss,
        takeProfit,
      } = req.body;

      if (!ctraderAuth.connected) {
        return res.status(401).json({
          success: false,
          message:
            "cTrader is not connected",
        });
      }

      const identity = tradingEndpointIdentity();

      if (!identity.ok) {
        return res.status(identity.status).json({
          success: false,
          code: identity.code,
          message: identity.message,
        });
      }

      if (!positionId) {
        return res.status(400).json({
          success: false,
          message:
            "Position ID is required",
        });
      }

      await ensureServiceRunning();

      const result =
        await amendPositionSLTP({
          positionId,
          stopLoss,
          takeProfit,
        });

      return res.json(result);
    } catch (error) {
      console.error(
        "❌ Amend position SL/TP error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: error.message,

        service:
          getCTraderServiceStatus(),
      });
    }
  }
);

// ============================================================
// SERVICE STATUS
// ============================================================

router.get(
  "/service-status",
  (req, res) => {
    return res.json({
      success: true,

      activeAccount:
        getActiveAccount(),

      service:
        getCTraderServiceStatus(),
    });
  }
);

// ============================================================
// DISCONNECT
// ============================================================

router.post(
  "/disconnect",
  async (req, res) => {
    try {
      try {
        await stopCTraderService();
      } catch {
        console.log(
          "⚠️ Service was already stopped."
        );
      }

      const next = {
        connected: false,
        accessToken: null,
        refreshToken: null,
        expiresIn: null,
        accounts: [],
        activeAccountId: null,
      };

      /* The saved session goes first. Until the store has given it up
         the process still holds a token it has not released, and
         dropping it from memory anyway would leave the next boot
         finding a connection the caller was told was closed. */
      clearSavedAuth();

      ctraderAuth = next;

      livePrices.clear();

      console.log(
        "🔌 cTrader disconnected successfully."
      );

      return res.json({
        success: true,

        message:
          "cTrader disconnected successfully",
      });
    } catch (error) {
      console.error(
        "❌ Disconnect error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ============================================================
// BROKER AUTH SUMMARY
// ============================================================

// Read-only projection of the in-process cTrader auth state for the broker
// adapters. Token values are never included — only their presence.

export function getBrokerAuthSummary() {
  return {
    connected: Boolean(ctraderAuth.connected),

    hasAccessToken: Boolean(ctraderAuth.accessToken),

    hasRefreshToken: Boolean(ctraderAuth.refreshToken),

    activeAccountId: ctraderAuth.activeAccountId,

    accounts: ctraderAuth.accounts.map((account) => ({
      accountId: account.accountId,
      name: account.name,
      createdAt: account.createdAt,
    })),
  };
}

// ============================================================
// EXPORT
// ============================================================

export default router;