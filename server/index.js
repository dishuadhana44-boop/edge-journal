import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { WebSocketServer } from "ws";

import ctraderRouter from "./routes/ctrader.js";
import mt5Router from "./routes/mt5.js";
import aiRouter from "./routes/ai.js";
import { createBrokersRouter } from "./routes/brokers.js";
import { getDefaultAdapters } from "./brokers/index.js";

import {
  addClient,
  removeClient,
} from "./services/websocketService.js";

import { ENV_FILE } from "./runtimePaths.js";

import {
  createPeerAdmissionMiddleware,
  resolveAllowlist,
} from "./security/peerAdmissionMiddleware.js";

dotenv.config({ path: ENV_FILE });

/* ============================================================
   EXPRESS APP
============================================================ */

const app = express();

/* ============================================================
   MIDDLEWARE
============================================================ */

app.use(
  cors({
    origin: [
      "http://localhost:5174",
      "http://127.0.0.1:5174",
    ],
    credentials: true,
  })
);

app.use(express.json());

/* ============================================================
   HEALTH CHECK
============================================================ */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "EdgeFlo broker server is running",
  });
});

/* ============================================================
   PEER ADMISSION FOR THE cTRADER API

   SERVER_ALLOW names exact IPv4 peers that may connect to this
   machine, in addition to the loopback addresses always admitted.
   Unset or blank means loopback-only, the safe default.

   A list the rule cannot fully understand is a wider hole than an
   empty one, so an unusable value stops the boot rather than being
   partly trusted. Remote tailnet peers routed through Tailscale
   Serve still arrive as loopback and are admitted by it; that
   dependency is tracked separately, not solved here.
============================================================ */

const SERVER_ALLOW_VERDICT = resolveAllowlist(process.env.SERVER_ALLOW);

if (!SERVER_ALLOW_VERDICT.ok) {
  throw new Error(
    `SERVER_ALLOW is not usable (${SERVER_ALLOW_VERDICT.code}): ` +
      `${SERVER_ALLOW_VERDICT.detail} ` +
      "Refusing to start the broker server with a partly understood peer allowlist.",
  );
}

/* ============================================================
   cTRADER ROUTES
============================================================ */

app.use(
  "/api/ctrader",
  createPeerAdmissionMiddleware({
    allowlist: SERVER_ALLOW_VERDICT.entries,
    log: (line) => console.warn(line),
  }),
  ctraderRouter
);

/* ============================================================
   METATRADER 5 ROUTES
============================================================ */

app.use("/api/mt5", mt5Router);

/* ============================================================
   AI TRADING ASSISTANT (server-side Gemini key)
============================================================ */

app.use("/api/ai", aiRouter);

/* ============================================================
   BROKER ADAPTER STATUS (aggregate, backend-only boundary)
============================================================ */

app.use(
  "/api/brokers",
  createBrokersRouter({ adapters: getDefaultAdapters() })
);

/* ============================================================
   HTTP SERVER
============================================================ */

const server = http.createServer(app);

/* ============================================================
   WEBSOCKET SERVER
============================================================ */

const wss = new WebSocketServer({
  server,
  path: "/ws",
});

/* ============================================================
   FRONTEND WEBSOCKET CONNECTION
============================================================ */

wss.on("connection", (ws) => {
  console.log("🟢 Frontend connected to WebSocket");

  /* ----------------------------------------------------------
     ADD CLIENT
  ---------------------------------------------------------- */

  addClient(ws);

  /* ----------------------------------------------------------
     CONNECTION CONFIRMATION
  ---------------------------------------------------------- */

  try {
    ws.send(
      JSON.stringify({
        type: "connection",
        success: true,
        message:
          "Connected to EdgeFlo WebSocket server",
      })
    );
  } catch (error) {
    console.error(
      "❌ WebSocket connection confirmation error:",
      error.message
    );
  }

  /* ----------------------------------------------------------
     FRONTEND MESSAGE
  ---------------------------------------------------------- */

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(
        message.toString()
      );

      console.log(
        "📩 Frontend WebSocket message:",
        data
      );

      ws.send(
        JSON.stringify({
          type: "ack",
          success: true,
          received: data,
        })
      );
    } catch (error) {
      console.error(
        "❌ Invalid WebSocket message:",
        error.message
      );

      try {
        ws.send(
          JSON.stringify({
            type: "error",
            success: false,
            message: "Invalid JSON message",
          })
        );
      } catch {
        // Ignore WebSocket send errors
      }
    }
  });

  /* ----------------------------------------------------------
     CLOSE
  ---------------------------------------------------------- */

  ws.on("close", () => {
    console.log(
      "🔴 Frontend disconnected from WebSocket"
    );

    removeClient(ws);
  });

  /* ----------------------------------------------------------
     ERROR
  ---------------------------------------------------------- */

  ws.on("error", (error) => {
    console.error(
      "❌ Frontend WebSocket error:",
      error.message
    );

    removeClient(ws);
  });
});

/* ============================================================
   404 API HANDLER
============================================================ */

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
  });
});

/* ============================================================
   START SERVER
============================================================ */

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log("");

  console.log(
    "===================================="
  );

  console.log(
    "🚀 EDGEFLO BROKER SERVER"
  );

  console.log(
    "===================================="
  );

  console.log(
    `HTTP Server: http://localhost:${PORT}`
  );

  console.log(
    `WebSocket: ws://localhost:${PORT}/ws`
  );

  console.log(
    "===================================="
  );

  console.log(
    "✅ HTTP API ready"
  );

  console.log(
    "✅ cTrader routes ready"
  );

  console.log(
    "✅ MetaTrader 5 routes ready"
  );

  console.log(
    "✅ Frontend WebSocket ready"
  );

  console.log(
    "===================================="
  );

  console.log("");

  console.log(
    "🟢 EDGEFLO SERVER READY"
  );

  console.log(
    "===================================="
  );

  console.log("");
});