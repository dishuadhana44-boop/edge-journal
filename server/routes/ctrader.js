import express from "express";

const router = express.Router();

// Temporary storage for local development.
// Later we can move this to a database/session.
let ctraderAuth = {
  connected: false,
  accessToken: null,
  refreshToken: null,
  expiresIn: null,
  accountId: null,
};

// ==========================================
// cTrader OAuth LOGIN
// ==========================================
router.get("/connect", (req, res) => {
  try {
    const clientId = process.env.CTRADER_CLIENT_ID;
    const redirectUri = process.env.CTRADER_REDIRECT_URI;

    if (!clientId) {
      return res.status(500).json({
        success: false,
        message: "CTRADER_CLIENT_ID is missing in .env",
      });
    }

    if (!redirectUri) {
      return res.status(500).json({
        success: false,
        message: "CTRADER_REDIRECT_URI is missing in .env",
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

    console.log("====================================");
    console.log("cTrader OAuth URL:");
    console.log(authUrl);
    console.log("====================================");

    res.redirect(authUrl);
  } catch (error) {
    console.error("cTrader Connect Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==========================================
// cTrader CALLBACK
// ==========================================
router.get("/callback", async (req, res) => {
  try {
    console.log("====================================");
    console.log("cTrader CALLBACK");
    console.log("Query:", req.query);
    console.log("====================================");

    const { code, error, description } = req.query;

    // User denied access
    if (error) {
      console.error("cTrader OAuth Error:", error, description);

      return res.redirect(
        `http://localhost:5173/settings?ctrader=error&message=${encodeURIComponent(
          description || error
        )}`
      );
    }

    // No authorization code
    if (!code) {
      console.error("No authorization code received");

      return res.redirect(
        "http://localhost:5173/settings?ctrader=error&message=no_code"
      );
    }

    const clientId = process.env.CTRADER_CLIENT_ID;
    const clientSecret = process.env.CTRADER_CLIENT_SECRET;
    const redirectUri = process.env.CTRADER_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error("Missing cTrader environment variables");

      return res.redirect(
        "http://localhost:5173/settings?ctrader=error&message=server_config_missing"
      );
    }

    // ==========================================
    // EXCHANGE AUTHORIZATION CODE FOR TOKEN
    // ==========================================

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokenUrl =
      `https://openapi.ctrader.com/apps/token?${tokenParams.toString()}`;

    console.log("Exchanging authorization code for access token...");

    const tokenResponse = await fetch(tokenUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const tokenData = await tokenResponse.json();

    console.log("cTrader Token Response:", {
      success: Boolean(tokenData.accessToken),
      errorCode: tokenData.errorCode,
      description: tokenData.description,
    });

    if (!tokenResponse.ok || !tokenData.accessToken) {
      console.error("Token exchange failed:", tokenData);

      return res.redirect(
        `http://localhost:5173/settings?ctrader=error&message=${encodeURIComponent(
          tokenData.description || tokenData.errorCode || "token_exchange_failed"
        )}`
      );
    }

    // ==========================================
    // SAVE TOKEN
    // ==========================================

    ctraderAuth = {
      connected: true,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken || null,
      expiresIn: tokenData.expiresIn || null,
      accountId: null,
    };

    console.log("====================================");
    console.log("cTrader CONNECTED SUCCESSFULLY");
    console.log("====================================");

    // Redirect frontend
    return res.redirect(
      "http://localhost:5173/settings?ctrader=connected"
    );
  } catch (error) {
    console.error("cTrader Callback Error:", error);

    return res.redirect(
      `http://localhost:5173/settings?ctrader=error&message=${encodeURIComponent(
        error.message
      )}`
    );
  }
});

// ==========================================
// CHECK STATUS
// ==========================================
router.get("/status", (req, res) => {
  res.json({
    success: true,
    connected: ctraderAuth.connected,
    accountId: ctraderAuth.accountId,
  });
});

// ==========================================
// DISCONNECT
// ==========================================
router.post("/disconnect", (req, res) => {
  ctraderAuth = {
    connected: false,
    accessToken: null,
    refreshToken: null,
    expiresIn: null,
    accountId: null,
  };

  console.log("cTrader disconnected");

  res.json({
    success: true,
    message: "cTrader disconnected",
  });
});

// ==========================================
// SAVE ACCOUNT ID
// ==========================================
router.post("/account", (req, res) => {
  const { accountId } = req.body;

  if (!ctraderAuth.connected) {
    return res.status(401).json({
      success: false,
      message: "cTrader is not connected",
    });
  }

  if (!accountId) {
    return res.status(400).json({
      success: false,
      message: "Account ID is required",
    });
  }

  ctraderAuth.accountId = accountId;

  res.json({
    success: true,
    accountId,
  });
});

// ==========================================
// GET SAVED TOKEN
// DEVELOPMENT ONLY
// ==========================================
router.get("/debug", (req, res) => {
  res.json({
    connected: ctraderAuth.connected,
    hasAccessToken: Boolean(ctraderAuth.accessToken),
    hasRefreshToken: Boolean(ctraderAuth.refreshToken),
    accountId: ctraderAuth.accountId,
  });
});

// ==========================================
// DEVELOPMENT ONLY - GET CTRADER TOKEN
// ==========================================

router.get("/debug-token", (req, res) => {
  if (!ctraderAuth.connected || !ctraderAuth.accessToken) {
    return res.status(401).json({
      success: false,
      message: "cTrader is not connected",
    });
  }

  res.json({
    success: true,
    accessToken: ctraderAuth.accessToken,
    accountId: ctraderAuth.accountId,
  });
});

export default router;