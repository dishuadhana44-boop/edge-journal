import express from "express";
import axios from "axios";

const router = express.Router();

const MT5_BRIDGE_URL =
  process.env.MT5_BRIDGE_URL || "http://127.0.0.1:5001";

const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";

// ==========================================================
// CONNECT
// GET /api/mt5/connect
// ==========================================================

router.get("/connect", async (req, res) => {
  try {
    const response = await axios.get(
      `${MT5_BRIDGE_URL}/mt5/status`,
      { timeout: 5000 }
    );

    const connected = Boolean(response.data?.connected);

    return res.redirect(
      `${FRONTEND_URL}/settings?mt5=${
        connected ? "connected" : "disconnected"
      }`
    );
  } catch (error) {
    console.error(
      "âŒ MT5 connect check failed:",
      error.response?.data || error.message
    );

    return res.redirect(
      `${FRONTEND_URL}/settings?mt5=error`
    );
  }
});

// ==========================================================
// STATUS
// GET /api/mt5/status
// ==========================================================

router.get("/status", async (req, res) => {
  try {
    const response = await axios.get(
      `${MT5_BRIDGE_URL}/mt5/status`,
      { timeout: 5000 }
    );

    return res.json(response.data);
  } catch (error) {
    console.error(
      "âŒ MT5 status error:",
      error.response?.data || error.message
    );

    return res.status(503).json({
      success: false,
      connected: false,
      message: "Unable to connect to MT5 bridge.",
      error: error.message,
    });
  }
});

// ==========================================================
// ACCOUNT
// GET /api/mt5/account
// ==========================================================

router.get("/account", async (req, res) => {
  try {
    const response = await axios.get(
      `${MT5_BRIDGE_URL}/mt5/account`,
      { timeout: 5000 }
    );

    return res.json(response.data);
  } catch (error) {
    console.error(
      "âŒ MT5 account error:",
      error.response?.data || error.message
    );

    return res.status(503).json({
      success: false,
      message: "Unable to fetch MT5 account.",
      error: error.message,
    });
  }
});

// ==========================================================
// LIVE PRICE
// GET /api/mt5/price?symbol=EURUSD
// ==========================================================

router.get("/price", async (req, res) => {
  try {
    const symbol = String(
      req.query.symbol || "EURUSD"
    )
      .trim()
      .toUpperCase();

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: "Symbol is required.",
      });
    }

    const response = await axios.get(
      `${MT5_BRIDGE_URL}/mt5/price`,
      {
        params: { symbol },
        timeout: 5000,
      }
    );

    return res.json(response.data);
  } catch (error) {
    console.error(
      "âŒ MT5 price error:",
      error.response?.data || error.message
    );

    return res.status(503).json({
      success: false,
      connected: false,
      symbol: req.query.symbol || "EURUSD",
      message: "Unable to fetch MT5 market price.",
      error: error.message,
    });
  }
});

// ==========================================================
// OPEN POSITIONS
// GET /api/mt5/positions
// ==========================================================

router.get("/positions", async (req, res) => {
  try {
    const response = await axios.get(
      `${MT5_BRIDGE_URL}/mt5/positions`,
      { timeout: 5000 }
    );

    return res.json(response.data);
  } catch (error) {
    console.error(
      "âŒ MT5 positions error:",
      error.response?.data || error.message
    );

    return res.status(503).json({
      success: false,
      positions: [],
      message: "Unable to fetch MT5 positions.",
      error: error.message,
    });
  }
});

// ==========================================================
// HISTORY
// GET /api/mt5/history?days=30
// ==========================================================

router.get("/history", async (req, res) => {
  try {
    const days = Number(req.query.days || 30);

    const response = await axios.get(
      `${MT5_BRIDGE_URL}/mt5/history`,
      {
        params: { days },
        timeout: 10000,
      }
    );

    return res.json(response.data);
  } catch (error) {
    console.error(
      "âŒ MT5 history error:",
      error.response?.data || error.message
    );

    return res.status(503).json({
      success: false,
      history: [],
      message: "Unable to fetch MT5 trade history.",
      error: error.message,
    });
  }
});

// ==========================================================
// PLACE MARKET ORDER
// POST /api/mt5/order
// ==========================================================

router.post("/order", async (req, res) => {
  try {
    console.log(
      "ðŸš€ MT5 ORDER REQUEST:",
      req.body
    );

    const {
      symbol,
      side,
      lots,
      stopLoss,
      takeProfit,
      comment,
      magic,
      deviation,
    } = req.body;

    // ------------------------------------------------------
    // VALIDATION
    // ------------------------------------------------------

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: "Symbol is required.",
      });
    }

    if (!side) {
      return res.status(400).json({
        success: false,
        message: "Order side is required.",
      });
    }

    if (
      lots === undefined ||
      lots === null ||
      !Number.isFinite(Number(lots)) ||
      Number(lots) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid lot size is required.",
      });
    }

    const normalizedSymbol = String(symbol)
      .trim()
      .toUpperCase();

    const normalizedSide = String(side)
      .trim()
      .toUpperCase();

    const normalizedLots = Number(lots);

    let normalizedStopLoss = null;

    if (
      stopLoss !== undefined &&
      stopLoss !== null &&
      stopLoss !== ""
    ) {
      normalizedStopLoss = Number(stopLoss);

      if (
        !Number.isFinite(normalizedStopLoss) ||
        normalizedStopLoss <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid Stop Loss price.",
        });
      }
    }

    let normalizedTakeProfit = null;

    if (
      takeProfit !== undefined &&
      takeProfit !== null &&
      takeProfit !== ""
    ) {
      normalizedTakeProfit = Number(takeProfit);

      if (
        !Number.isFinite(normalizedTakeProfit) ||
        normalizedTakeProfit <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid Take Profit price.",
        });
      }
    }

    // ------------------------------------------------------
    // SEND TO MT5 BRIDGE
    // ------------------------------------------------------

    const response = await axios.post(
      `${MT5_BRIDGE_URL}/mt5/order`,
      {
        symbol: normalizedSymbol,
        side: normalizedSide,
        lots: normalizedLots,
        stopLoss: normalizedStopLoss,
        takeProfit: normalizedTakeProfit,
        comment:
          comment || "EdgeFlo MT5",
        magic:
          magic !== undefined
            ? Number(magic)
            : 2026001,
        deviation:
          deviation !== undefined
            ? Number(deviation)
            : 50,
      },
      {
        timeout: 15000,
      }
    );

    console.log(
      "ðŸ“© MT5 BRIDGE ORDER RESPONSE:",
      response.data
    );

    return res
      .status(response.status)
      .json(response.data);
  } catch (error) {
    console.error(
      "âŒ MT5 order error:",
      error.response?.data ||
        error.message
    );

    return res.status(
      error.response?.status || 503
    ).json(
      error.response?.data || {
        success: false,
        message:
          "Unable to place MT5 order.",
        error: error.message,
      }
    );
  }
});

// ==========================================================
// PLACE PENDING ORDER
// POST /api/mt5/pending-order
// ==========================================================

router.post(
  "/pending-order",
  async (req, res) => {
    try {
      console.log(
        "ðŸ“Œ MT5 PENDING ORDER REQUEST:",
        req.body
      );

      const {
        symbol,
        side,
        type,
        orderType,
        lots,
        entry,
        stopLoss,
        takeProfit,
        comment,
        magic,
        expiration,
      } = req.body;

      // ----------------------------------------------------
      // VALIDATION
      // ----------------------------------------------------

      if (!symbol) {
        return res.status(400).json({
          success: false,
          message: "Symbol is required.",
        });
      }

      if (!side) {
        return res.status(400).json({
          success: false,
          message: "Pending order side is required.",
        });
      }

      const normalizedSide = String(side)
        .trim()
        .toUpperCase();

      if (
        normalizedSide !== "BUY" &&
        normalizedSide !== "SELL"
      ) {
        return res.status(400).json({
          success: false,
          message: "Side must be BUY or SELL.",
        });
      }

      const rawType = type || orderType;

      if (!rawType) {
        return res.status(400).json({
          success: false,
          message: "Pending order type is required.",
        });
      }

      if (
        lots === undefined ||
        lots === null ||
        !Number.isFinite(Number(lots)) ||
        Number(lots) <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Valid lot size is required.",
        });
      }

      if (
        entry === undefined ||
        entry === null ||
        entry === "" ||
        !Number.isFinite(Number(entry)) ||
        Number(entry) <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Valid entry price is required.",
        });
      }

      const normalizedSymbol = String(
        symbol
      )
        .trim()
        .toUpperCase();

      const normalizedType = String(rawType)
        .trim()
        .toUpperCase();

      const normalizedLots = Number(lots);
      const normalizedEntry = Number(entry);

      // ----------------------------------------------------
      // ALLOWED PENDING TYPES
      // ----------------------------------------------------

      const allowedTypes = [
        "BUY_LIMIT",
        "SELL_LIMIT",
        "BUY_STOP",
        "SELL_STOP",
        "BUY_STOP_LIMIT",
        "SELL_STOP_LIMIT",
      ];

      if (!allowedTypes.includes(normalizedType)) {
        return res.status(400).json({
          success: false,
          message:
            `Unsupported pending order type: ${normalizedType}`,
        });
      }

      // ----------------------------------------------------
      // STOP LOSS
      // ----------------------------------------------------

      let normalizedStopLoss = null;

      if (
        stopLoss !== undefined &&
        stopLoss !== null &&
        stopLoss !== ""
      ) {
        normalizedStopLoss = Number(
          stopLoss
        );

        if (
          !Number.isFinite(
            normalizedStopLoss
          ) ||
          normalizedStopLoss <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid Stop Loss price.",
          });
        }
      }

      // ----------------------------------------------------
      // TAKE PROFIT
      // ----------------------------------------------------

      let normalizedTakeProfit = null;

      if (
        takeProfit !== undefined &&
        takeProfit !== null &&
        takeProfit !== ""
      ) {
        normalizedTakeProfit = Number(
          takeProfit
        );

        if (
          !Number.isFinite(
            normalizedTakeProfit
          ) ||
          normalizedTakeProfit <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid Take Profit price.",
          });
        }
      }

      // ----------------------------------------------------
      // EXPIRATION
      // ----------------------------------------------------

      let normalizedExpiration = 0;

      if (
        expiration !== undefined &&
        expiration !== null &&
        expiration !== ""
      ) {
        normalizedExpiration =
          Number(expiration);

        if (
          !Number.isFinite(
            normalizedExpiration
          ) ||
          normalizedExpiration < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid expiration value.",
          });
        }
      }

      // ----------------------------------------------------
      // SEND TO MT5 PYTHON BRIDGE
      // ----------------------------------------------------

      const response = await axios.post(
        `${MT5_BRIDGE_URL}/mt5/pending-order`,
        {
          symbol: normalizedSymbol,
          side: normalizedSide,
          orderType: normalizedType,
          type: normalizedType,
          lots: normalizedLots,
          entry: normalizedEntry,
          stopLoss: normalizedStopLoss,
          takeProfit: normalizedTakeProfit,
          comment:
            comment ||
            "EdgeFlo Pending Order",
          magic:
            magic !== undefined
              ? Number(magic)
              : 2026001,
          expiration:
            normalizedExpiration,
        },
        {
          timeout: 15000,
        }
      );

      console.log(
        "ðŸ“© MT5 BRIDGE PENDING ORDER RESPONSE:",
        response.data
      );

      return res
        .status(response.status)
        .json(response.data);
    } catch (error) {
      console.error(
        "âŒ MT5 pending order error:",
        error.response?.data ||
          error.message
      );

      return res.status(
        error.response?.status || 503
      ).json(
        error.response?.data || {
          success: false,
          message:
            "Unable to place MT5 pending order.",
          error: error.message,
        }
      );
    }
  }
);

// ==========================================================
// GET PENDING ORDERS
// GET /api/mt5/orders
// ==========================================================

router.get("/orders", async (req, res) => {
  try {
    const response = await axios.get(
      `${MT5_BRIDGE_URL}/mt5/orders`,
      { timeout: 5000 }
    );

    return res.json(response.data);
  } catch (error) {
    console.error(
      "âŒ MT5 pending orders error:",
      error.response?.data ||
        error.message
    );

    return res.status(503).json({
      success: false,
      orders: [],
      count: 0,
      message:
        "Unable to fetch MT5 pending orders.",
      error: error.message,
    });
  }
});

// ==========================================================
// GET SINGLE PENDING ORDER
// GET /api/mt5/order/:ticket
// ==========================================================

router.get(
  "/order/:ticket",
  async (req, res) => {
    try {
      const ticket = Number(
        req.params.ticket
      );

      if (
        !Number.isInteger(ticket) ||
        ticket <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid order ticket.",
        });
      }

      const response = await axios.get(
        `${MT5_BRIDGE_URL}/mt5/order/${ticket}`,
        { timeout: 5000 }
      );

      return res.json(response.data);
    } catch (error) {
      console.error(
        "âŒ MT5 single order error:",
        error.response?.data ||
          error.message
      );

      return res.status(
        error.response?.status || 503
      ).json(
        error.response?.data || {
          success: false,
          message:
            "Unable to fetch MT5 order.",
          error: error.message,
        }
      );
    }
  }
);

// ==========================================================
// CLOSE POSITION
// POST /api/mt5/close-position
// ==========================================================

router.post(
  "/close-position",
  async (req, res) => {
    try {
      const {
        ticket,
        volume,
      } = req.body;

      if (
        ticket === undefined ||
        ticket === null
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Position ticket is required.",
        });
      }

      const response = await axios.post(
        `${MT5_BRIDGE_URL}/mt5/close-position`,
        {
          ticket,
          volume,
        },
        {
          timeout: 15000,
        }
      );

      return res.json(
        response.data
      );
    } catch (error) {
      console.error(
        "âŒ MT5 close position error:",
        error.response?.data ||
          error.message
      );

      return res.status(
        error.response?.status || 503
      ).json(
        error.response?.data || {
          success: false,
          message:
            "Unable to close MT5 position.",
          error: error.message,
        }
      );
    }
  }
);

// ==========================================================
// MODIFY OPEN POSITION SL/TP
// POST /api/mt5/modify-position
// ==========================================================

router.post(
  "/modify-position",
  async (req, res) => {
    try {
      const {
        ticket,
        positionId,
        brokerPositionId,
        id,
        stopLoss,
        takeProfit,
        sl,
        tp,
      } = req.body;

      // ----------------------------------------------------
      // POSITION TICKET
      // ----------------------------------------------------

      const rawTicket =
        ticket ??
        positionId ??
        brokerPositionId ??
        id;

      if (
        rawTicket === undefined ||
        rawTicket === null ||
        rawTicket === ""
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Position ticket is required.",
        });
      }

      const normalizedTicket =
        Number(rawTicket);

      if (
        !Number.isInteger(
          normalizedTicket
        ) ||
        normalizedTicket <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid position ticket.",
        });
      }

      // ----------------------------------------------------
      // SL
      // ----------------------------------------------------

      let normalizedStopLoss;

      const rawStopLoss =
        stopLoss !== undefined
          ? stopLoss
          : sl;

      if (
        rawStopLoss === undefined ||
        rawStopLoss === null ||
        rawStopLoss === ""
      ) {
        normalizedStopLoss = undefined;
      } else {
        normalizedStopLoss =
          Number(rawStopLoss);

        if (
          !Number.isFinite(
            normalizedStopLoss
          ) ||
          normalizedStopLoss < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid Stop Loss price.",
          });
        }
      }

      // ----------------------------------------------------
      // TP
      // ----------------------------------------------------

      let normalizedTakeProfit;

      const rawTakeProfit =
        takeProfit !== undefined
          ? takeProfit
          : tp;

      if (
        rawTakeProfit === undefined ||
        rawTakeProfit === null ||
        rawTakeProfit === ""
      ) {
        normalizedTakeProfit = undefined;
      } else {
        normalizedTakeProfit =
          Number(rawTakeProfit);

        if (
          !Number.isFinite(
            normalizedTakeProfit
          ) ||
          normalizedTakeProfit < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid Take Profit price.",
          });
        }
      }

      // ----------------------------------------------------
      // REQUEST LOG
      // ----------------------------------------------------

      console.log(
        "✏️ MT5 MODIFY OPEN POSITION:",
        {
          ticket:
            normalizedTicket,
          stopLoss:
            normalizedStopLoss,
          takeProfit:
            normalizedTakeProfit,
        }
      );

      // ----------------------------------------------------
      // SEND TO MT5 BRIDGE
      // ----------------------------------------------------

      const payload = {
        ticket:
          normalizedTicket,
      };

      if (
        normalizedStopLoss !== undefined
      ) {
        payload.stopLoss =
          normalizedStopLoss;
      }

      if (
        normalizedTakeProfit !== undefined
      ) {
        payload.takeProfit =
          normalizedTakeProfit;
      }

      const response =
        await axios.post(
          `${MT5_BRIDGE_URL}/mt5/modify-position`,
          payload,
          {
            timeout: 15000,
          }
        );

      console.log(
        "📩 MT5 MODIFY POSITION RESPONSE:",
        response.data
      );

      return res
        .status(response.status)
        .json(response.data);

    } catch (error) {
      console.error(
        "❌ MT5 modify open position error:",
        error.response?.data ||
          error.message
      );

      return res.status(
        error.response?.status || 503
      ).json(
        error.response?.data || {
          success: false,
          message:
            "Unable to modify MT5 open position.",
          error:
            error.message,
        }
      );
    }
  }
);

// ==========================================================
// CANCEL PENDING ORDER
// POST /api/mt5/cancel-order
// ==========================================================

router.post(
  "/cancel-order",
  async (req, res) => {
    try {
      const { ticket } = req.body;

      if (
        ticket === undefined ||
        ticket === null
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Pending order ticket is required.",
        });
      }

      const normalizedTicket =
        Number(ticket);

      if (
        !Number.isInteger(
          normalizedTicket
        ) ||
        normalizedTicket <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid pending order ticket.",
        });
      }

      console.log(
        "ðŸ—‘ï¸ MT5 CANCEL PENDING ORDER:",
        normalizedTicket
      );

      const response = await axios.post(
        `${MT5_BRIDGE_URL}/mt5/cancel-order`,
        {
          ticket:
            normalizedTicket,
        },
        {
          timeout: 15000,
        }
      );

      console.log(
        "ðŸ“© MT5 CANCEL RESPONSE:",
        response.data
      );

      return res
        .status(response.status)
        .json(response.data);
    } catch (error) {
      console.error(
        "âŒ MT5 cancel pending order error:",
        error.response?.data ||
          error.message
      );

      return res.status(
        error.response?.status || 503
      ).json(
        error.response?.data || {
          success: false,
          message:
            "Unable to cancel MT5 pending order.",
          error: error.message,
        }
      );
    }
  }
);

// ==========================================================
// MODIFY PENDING ORDER
// POST /api/mt5/modify-order
// ==========================================================

router.post(
  "/modify-order",
  async (req, res) => {
    try {
      const {
        ticket,
        price,
        stopLoss,
        takeProfit,
      } = req.body;

      // ----------------------------------------------------
      // TICKET
      // ----------------------------------------------------

      if (
        ticket === undefined ||
        ticket === null
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Pending order ticket is required.",
        });
      }

      const normalizedTicket =
        Number(ticket);

      if (
        !Number.isInteger(
          normalizedTicket
        ) ||
        normalizedTicket <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid pending order ticket.",
        });
      }

      // ----------------------------------------------------
      // ENTRY PRICE
      // ----------------------------------------------------

      if (
        price === undefined ||
        price === null ||
        price === ""
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Pending order entry price is required.",
        });
      }

      const normalizedPrice =
        Number(price);

      if (
        !Number.isFinite(
          normalizedPrice
        ) ||
        normalizedPrice <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid pending order entry price.",
        });
      }

      // ----------------------------------------------------
      // STOP LOSS
      // ----------------------------------------------------

      let normalizedStopLoss = null;

      if (
        stopLoss !== undefined &&
        stopLoss !== null &&
        stopLoss !== ""
      ) {
        normalizedStopLoss =
          Number(stopLoss);

        if (
          !Number.isFinite(
            normalizedStopLoss
          ) ||
          normalizedStopLoss <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid Stop Loss price.",
          });
        }
      }

      // ----------------------------------------------------
      // TAKE PROFIT
      // ----------------------------------------------------

      let normalizedTakeProfit = null;

      if (
        takeProfit !== undefined &&
        takeProfit !== null &&
        takeProfit !== ""
      ) {
        normalizedTakeProfit =
          Number(takeProfit);

        if (
          !Number.isFinite(
            normalizedTakeProfit
          ) ||
          normalizedTakeProfit <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid Take Profit price.",
          });
        }
      }

      console.log(
        "âœï¸ MT5 MODIFY PENDING ORDER:",
        {
          ticket:
            normalizedTicket,
          price:
            normalizedPrice,
          stopLoss:
            normalizedStopLoss,
          takeProfit:
            normalizedTakeProfit,
        }
      );

      // ----------------------------------------------------
      // SEND TO MT5 BRIDGE
      // ----------------------------------------------------

      const response = await axios.post(
        `${MT5_BRIDGE_URL}/mt5/modify-order`,
        {
          ticket:
            normalizedTicket,
          price:
            normalizedPrice,
          stopLoss:
            normalizedStopLoss,
          takeProfit:
            normalizedTakeProfit,
        },
        {
          timeout: 15000,
        }
      );

      console.log(
        "ðŸ“© MT5 MODIFY RESPONSE:",
        response.data
      );

      return res
        .status(response.status)
        .json(response.data);
    } catch (error) {
      console.error(
        "âŒ MT5 modify pending order error:",
        error.response?.data ||
          error.message
      );

      return res.status(
        error.response?.status || 503
      ).json(
        error.response?.data || {
          success: false,
          message:
            "Unable to modify MT5 pending order.",
          error: error.message,
        }
      );
    }
  }
);

// ==========================================================
// DISCONNECT
// POST /api/mt5/disconnect
// ==========================================================

router.post(
  "/disconnect",
  async (req, res) => {
    try {
      const response = await axios.post(
        `${MT5_BRIDGE_URL}/mt5/disconnect`,
        {},
        {
          timeout: 5000,
        }
      );

      return res.json(
        response.data
      );
    } catch (error) {
      console.error(
        "âŒ MT5 disconnect error:",
        error.response?.data ||
          error.message
      );

      return res.status(503).json({
        success: false,
        message:
          "Unable to disconnect MT5 bridge.",
        error: error.message,
      });
    }
  }
);

export default router;




