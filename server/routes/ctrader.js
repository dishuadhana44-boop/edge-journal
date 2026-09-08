import express from "express";
import fs from "fs";
import path from "path";

import {
  startCTraderService,
  stopCTraderService,
  placeMarketOrder,
  closePosition,
  amendPositionSLTP,
  getCTraderServiceStatus,
} from "../services/ctraderService.js";

import { broadcast } from "../services/websocketService.js";

const router = express.Router();

// ============================================================
// LOCAL AUTH STORAGE
// ============================================================

const AUTH_FILE = path.join(process.cwd(), "ctrader-auth.json");

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
// NORMALIZE SAVED ACCOUNT
// ============================================================

function normalizeAccount(account) {
  return {
    id:
      account.id ||
      `account-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    accountId: String(account.accountId).trim(),

    name: account.name || "Trading Account",

    createdAt:
      account.createdAt || new Date().toISOString(),
  };
}

// ============================================================
// LOAD SAVED AUTH
// ============================================================

function loadSavedAuth() {
  try {
    if (!fs.existsSync(AUTH_FILE)) {
      console.log("ℹ️ No saved cTrader authentication found.");
      return;
    }

    const savedData = fs.readFileSync(AUTH_FILE, "utf8");

    const parsed = JSON.parse(savedData);

    let accounts = [];

    // Multi-account format
    if (Array.isArray(parsed.accounts)) {
      accounts = parsed.accounts
        .filter(
          (account) =>
            account &&
            account.accountId !== undefined &&
            account.accountId !== null &&
            String(account.accountId).trim() !== ""
        )
        .map(normalizeAccount);
    }

    // Backward compatibility with old single-account format
    if (
      accounts.length === 0 &&
      parsed.accountId !== undefined &&
      parsed.accountId !== null &&
      String(parsed.accountId).trim() !== ""
    ) {
      accounts.push(
        normalizeAccount({
          accountId: parsed.accountId,
          name: "Imported Trading Account",
          createdAt: new Date().toISOString(),
        })
      );

      console.log(
        "🔄 Migrated old single account to multi-account system."
      );
    }

    const requestedActiveAccountId =
      parsed.activeAccountId ||
      parsed.accountId ||
      accounts[0]?.accountId ||
      null;

    const activeExists = accounts.some(
      (account) =>
        String(account.accountId) ===
        String(requestedActiveAccountId)
    );

    const activeAccountId = activeExists
      ? String(requestedActiveAccountId)
      : accounts[0]?.accountId || null;

    ctraderAuth = {
      connected: Boolean(parsed.connected),
      accessToken: parsed.accessToken || null,
      refreshToken: parsed.refreshToken || null,
      expiresIn: parsed.expiresIn || null,
      accounts,
      activeAccountId,
    };

    console.log("");
    console.log("====================================");
    console.log("✅ SAVED cTRADER AUTH LOADED");
    console.log("====================================");

    console.log({
      connected: ctraderAuth.connected,
      hasAccessToken: Boolean(ctraderAuth.accessToken),
      hasRefreshToken: Boolean(ctraderAuth.refreshToken),
      savedAccounts: ctraderAuth.accounts.length,
      activeAccountId: ctraderAuth.activeAccountId,
    });

    console.log("====================================");
  } catch (error) {
    console.error(
      "❌ Failed to load saved cTrader auth:",
      error.message
    );
  }
}

// ============================================================
// SAVE AUTH
// ============================================================

function saveAuth() {
  try {
    fs.writeFileSync(
      AUTH_FILE,
      JSON.stringify(ctraderAuth, null, 2),
      "utf8"
    );

    console.log("💾 cTrader auth saved locally.");
  } catch (error) {
    console.error(
      "❌ Failed to save cTrader auth:",
      error.message
    );
  }
}

// ============================================================
// CLEAR SAVED AUTH
// ============================================================

function clearSavedAuth() {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      fs.unlinkSync(AUTH_FILE);
    }

    console.log("🗑️ Saved cTrader auth removed.");
  } catch (error) {
    console.error(
      "❌ Failed to remove saved auth:",
      error.message
    );
  }
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

  const activeAccount = getActiveAccount();

  const message = {
    type: execution.type || "execution",

    accountId:
      execution.accountId ||
      execution.data?.accountId ||
      activeAccount?.accountId ||
      null,

    data: execution.data || execution,

    timestamp: Date.now(),
  };

  const clientsReached = broadcast(message);

  console.log(
    `📤 Execution broadcast to ${clientsReached} frontend client(s)`
  );
}

// ============================================================
// START cTRADER SERVICE
// ============================================================

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

  const currentStatus =
    getCTraderServiceStatus();

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

    return currentStatus;
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
    return status;
  }

  console.log(
    "⚠️ Trading service is not ready."
  );

  console.log(
    "🔄 Attempting to start cTrader service..."
  );

  await startService();

  const newStatus =
    getCTraderServiceStatus();

  if (
    !newStatus.authenticated ||
    !newStatus.ready
  ) {
    throw new Error(
      "cTrader trading service failed to authenticate."
    );
  }

  return newStatus;
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
        `http://localhost:5173/settings?ctrader=error&message=${message}`
      );
    }

    // No authorization code
    if (!code) {
      return res.redirect(
        "http://localhost:5173/settings?ctrader=error&message=no_code"
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
        "http://localhost:5173/settings?ctrader=error&message=server_config_missing"
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
      tokenData =
        await tokenResponse.json();
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
        `http://localhost:5173/settings?ctrader=error&message=${message}`
      );
    }

    // Save authentication
    // Keep existing accounts
    ctraderAuth = {
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

    saveAuth();

    console.log("");
    console.log("====================================");
    console.log(
      "✅ cTRADER OAUTH CONNECTED SUCCESSFULLY"
    );
    console.log("====================================");

    // Start service if account exists
    if (ctraderAuth.activeAccountId) {
      try {
        console.log(
          "🚀 Starting cTrader trading service..."
        );

        await startService();

        console.log(
          "✅ cTrader service started successfully"
        );

      } catch (serviceError) {
        console.error(
          "⚠️ OAuth connected, but service failed to start:",
          serviceError.message
        );
      }
    } else {
      console.log(
        "⚠️ OAuth connected. Waiting for account selection."
      );
    }

    return res.redirect(
      "http://localhost:5173/settings?ctrader=connected"
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
      `http://localhost:5173/settings?ctrader=error&message=${message}`
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
// ADD / SAVE TRADING ACCOUNT
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

    if (
      accountId === undefined ||
      accountId === null ||
      String(accountId).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Account ID is required",
      });
    }

    const newAccountId =
      String(accountId).trim();

    let savedAccount =
      ctraderAuth.accounts.find(
        (account) =>
          String(account.accountId) ===
          newAccountId
      );

    // Add new account
    if (!savedAccount) {
      savedAccount = {
        id:
          `account-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,

        accountId: newAccountId,

        name:
          accountName ||
          `Trading Account ${
            ctraderAuth.accounts.length + 1
          }`,

        createdAt:
          new Date().toISOString(),
      };

      ctraderAuth.accounts.push(
        savedAccount
      );

      console.log(
        "➕ New trading account added:",
        savedAccount
      );

    } else {
      // Optional name update
      if (
        accountName &&
        String(accountName).trim()
      ) {
        savedAccount.name =
          String(accountName).trim();
      }

      console.log(
        "ℹ️ Trading account already exists:",
        savedAccount.accountId
      );
    }

    const accountChanged =
      String(ctraderAuth.activeAccountId) !==
      newAccountId;

    ctraderAuth.activeAccountId =
      newAccountId;

    saveAuth();

    console.log(
      "✅ Active cTrader account:",
      ctraderAuth.activeAccountId
    );

    // Stop previous service
    if (accountChanged) {
      try {
        console.log(
          "🔄 Stopping previous cTrader service..."
        );

        await stopCTraderService();

      } catch {
        console.log(
          "⚠️ Previous service was not running."
        );
      }
    }

    // Start service
    let service =
      getCTraderServiceStatus();

    try {
      service =
        await startService();

    } catch (error) {
      console.error(
        "⚠️ Account saved but service failed to start:",
        error.message
      );
    }

    return res.json({
      success: true,

      message:
        "Trading account saved successfully",

      account: savedAccount,

      accounts:
        ctraderAuth.accounts,

      activeAccountId:
        ctraderAuth.activeAccountId,

      service,
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
// SELECT / SWITCH ACCOUNT
// ============================================================

router.post(
  "/accounts/select",
  async (req, res) => {
    try {
      const { accountId } = req.body;

      if (
        accountId === undefined ||
        accountId === null ||
        String(accountId).trim() === ""
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Account ID is required",
        });
      }

      const selectedAccount =
        ctraderAuth.accounts.find(
          (account) =>
            String(account.accountId) ===
            String(accountId).trim()
        );

      if (!selectedAccount) {
        return res.status(404).json({
          success: false,
          message:
            "Account not found",
        });
      }

      const previousAccountId =
        ctraderAuth.activeAccountId;

      ctraderAuth.activeAccountId =
        selectedAccount.accountId;

      saveAuth();

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
        to: selectedAccount.accountId,
        accountName:
          selectedAccount.name,
      });

      // Stop old service
      if (
        previousAccountId !==
        selectedAccount.accountId
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

      const service =
        await startService();

      return res.json({
        success: true,

        message:
          "Account switched successfully",

        activeAccount:
          selectedAccount,

        activeAccountId:
          selectedAccount.accountId,

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

      const accountIndex =
        ctraderAuth.accounts.findIndex(
          (account) =>
            String(account.accountId) ===
            accountId
        );

      if (accountIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Account not found",
        });
      }

      const accountToDelete =
        ctraderAuth.accounts[
          accountIndex
        ];

      const isActiveAccount =
        String(
          ctraderAuth.activeAccountId
        ) === accountId;

      // Stop service if active account is deleted
      if (isActiveAccount) {
        try {
          await stopCTraderService();

        } catch {
          console.log(
            "⚠️ Service was already stopped."
          );
        }
      }

      ctraderAuth.accounts.splice(
        accountIndex,
        1
      );

      // Select another account
      if (isActiveAccount) {
        ctraderAuth.activeAccountId =
          ctraderAuth.accounts[0]
            ?.accountId || null;
      }

      saveAuth();

      // Start next account automatically
      if (
        isActiveAccount &&
        ctraderAuth.activeAccountId
      ) {
        try {
          await startService();

        } catch (error) {
          console.error(
            "⚠️ Next account service failed to start:",
            error.message
          );
        }
      }

      console.log(
        "🗑️ Trading account removed:",
        accountToDelete.accountId
      );

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

    if (!ctraderAuth.activeAccountId) {
      return res.status(400).json({
        success: false,
        message:
          "No active trading account selected",
      });
    }

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: "Symbol is required",
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

    console.log(
      `📈 Placing order on account: ${ctraderAuth.activeAccountId}`
    );

    const result =
      await placeMarketOrder({
        symbol,
        side,
        lots,
        stopLoss,
        takeProfit,
        label,
        comment,
      });

    return res.json({
      ...result,

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

      if (!ctraderAuth.activeAccountId) {
        return res.status(400).json({
          success: false,
          message:
            "No active trading account selected",
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
        await closePosition({
          positionId,
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

      if (!ctraderAuth.activeAccountId) {
        return res.status(400).json({
          success: false,
          message:
            "No active trading account selected",
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

      ctraderAuth = {
        connected: false,
        accessToken: null,
        refreshToken: null,
        expiresIn: null,
        accounts: [],
        activeAccountId: null,
      };

      livePrices.clear();

      clearSavedAuth();

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
// EXPORT
// ============================================================

export default router;