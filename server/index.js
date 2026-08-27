import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { WebSocketServer } from "ws";

import ctraderRouter from "./routes/ctrader.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "EdgeFlo broker server is running",
  });
});

// cTrader routes
app.use("/api/ctrader", ctraderRouter);

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({
  server,
  path: "/ws",
});

// WebSocket connection
wss.on("connection", (ws) => {
  console.log("🔌 WebSocket client connected");

  ws.send(
    JSON.stringify({
      type: "connection",
      success: true,
      message: "Connected to EdgeFlo WebSocket server",
    })
  );

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      console.log("📩 WebSocket message:", data);

      // Temporary response
      ws.send(
        JSON.stringify({
          type: "ack",
          success: true,
          received: data,
        })
      );
    } catch (error) {
      console.error("❌ Invalid WebSocket message:", error.message);

      ws.send(
        JSON.stringify({
          type: "error",
          success: false,
          message: "Invalid JSON message",
        })
      );
    }
  });

  ws.on("close", () => {
    console.log("🔌 WebSocket client disconnected");
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error.message);
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 EdgeFlo broker server running on port ${PORT}`);
  console.log(`🔌 WebSocket server running on ws://localhost:${PORT}/ws`);
});