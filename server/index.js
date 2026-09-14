import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { WebSocketServer } from "ws";

import ctraderRouter from "./routes/ctrader.js";
import mt5Router from "./routes/mt5.js";

import {
  addClient,
  removeClient,
} from "./services/websocketService.js";

dotenv.config();

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
      "http://localhost:5173",
      "http://127.0.0.1:5173",
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
   cTRADER ROUTES
============================================================ */

app.use("/api/ctrader", ctraderRouter);

/* ============================================================
   METATRADER 5 ROUTES
============================================================ */

app.use("/api/mt5", mt5Router);

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