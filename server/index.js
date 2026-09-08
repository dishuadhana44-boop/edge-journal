import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { WebSocketServer } from "ws";

import ctraderRouter from "./routes/ctrader.js";

import {
  addClient,
  removeClient,
} from "./services/websocketService.js";

dotenv.config();

// ============================================================
// EXPRESS APP
// ============================================================

const app = express();

app.use(cors());

app.use(express.json());

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "EdgeFlo broker server is running",
  });
});

// ============================================================
// cTRADER ROUTES
// ============================================================

app.use("/api/ctrader", ctraderRouter);

// ============================================================
// HTTP SERVER
// ============================================================

const server = http.createServer(app);

// ============================================================
// WEBSOCKET SERVER
// ============================================================

const wss = new WebSocketServer({
  server,
  path: "/ws",
});

// ============================================================
// FRONTEND WEBSOCKET CONNECTION
// ============================================================

wss.on("connection", (ws) => {

  // ----------------------------------------------------------
  // ADD CLIENT
  // ----------------------------------------------------------

  addClient(ws);

  // ----------------------------------------------------------
  // CONNECTION CONFIRMATION
  // ----------------------------------------------------------

  try {
    ws.send(
      JSON.stringify({
        type: "connection",
        success: true,
        message: "Connected to EdgeFlo WebSocket server",
      })
    );
  } catch (error) {
    console.error(
      "❌ WebSocket connection confirmation error:",
      error.message
    );
  }

  // ----------------------------------------------------------
  // FRONTEND MESSAGE
  // ----------------------------------------------------------

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(
        message.toString()
      );

      console.log(
        "📩 Frontend WebSocket message:",
        data
      );

      // Acknowledge frontend message

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
        // Ignore send error
      }

    }
  });

  // ----------------------------------------------------------
  // CLOSE
  // ----------------------------------------------------------

  ws.on("close", () => {
    removeClient(ws);
  });

  // ----------------------------------------------------------
  // ERROR
  // ----------------------------------------------------------

  ws.on("error", (error) => {

    console.error(
      "❌ Frontend WebSocket error:",
      error.message
    );

    removeClient(ws);

  });

});

// ============================================================
// START SERVER
// ============================================================

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
    "Waiting for cTrader OAuth connection..."
  );

  console.log(
    "===================================="
  );

});