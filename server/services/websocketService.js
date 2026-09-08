import WebSocket from "ws";

// ============================================================
// FRONTEND WEBSOCKET CLIENTS
// ============================================================

const clients = new Set();

// ============================================================
// LAST LIVE PRICE CACHE
// ============================================================

let lastPriceMessage = null;

// ============================================================
// ADD CLIENT
// ============================================================

export function addClient(ws) {

  clients.add(ws);

  console.log(
    `🔌 Frontend WebSocket connected. Clients: ${clients.size}`
  );

  // ==========================================================
  // SEND LAST KNOWN PRICE TO NEW CLIENT
  // ==========================================================

  if (
    lastPriceMessage &&
    ws.readyState === WebSocket.OPEN
  ) {

    try {

      ws.send(
        JSON.stringify(lastPriceMessage)
      );

      console.log(
        `📤 Sent cached live price to new client: ${lastPriceMessage.symbol}`
      );

    } catch (error) {

      console.error(
        "❌ Cached price send error:",
        error.message
      );

    }

  }

}

// ============================================================
// REMOVE CLIENT
// ============================================================

export function removeClient(ws) {

  const existed = clients.delete(ws);

  if (existed) {

    console.log(
      `🔌 Frontend WebSocket disconnected. Clients: ${clients.size}`
    );

  }

}

// ============================================================
// BROADCAST MESSAGE TO ALL FRONTEND CLIENTS
// ============================================================

export function broadcast(data) {

  // ==========================================================
  // SAVE LATEST PRICE
  // ==========================================================

  if (data && data.type === "price") {

    lastPriceMessage = data;

  }

  const message = JSON.stringify(data);

  let sentCount = 0;

  for (const client of clients) {

    if (client.readyState === WebSocket.OPEN) {

      try {

        client.send(message);

        sentCount++;

      } catch (error) {

        console.error(
          "❌ WebSocket send error:",
          error.message
        );

      }

    }

  }

  return sentCount;

}

// ============================================================
// GET LAST PRICE
// ============================================================

export function getLastPrice() {

  return lastPriceMessage;

}

// ============================================================
// GET CLIENT COUNT
// ============================================================

export function getClientCount() {

  return clients.size;

}