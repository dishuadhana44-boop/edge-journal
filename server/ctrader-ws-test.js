import fs from "fs";
import path from "path";
import protobuf from "protobufjs";
import WebSocket from "ws";
import dotenv from "dotenv";

dotenv.config();

// ============================================================
// CONFIG
// ============================================================

// DEMO ACCOUNT
const WS_URL = "wss://demo.ctraderapi.com:5035";

// LIVE ACCOUNT ke liye:
// const WS_URL = "wss://live.ctraderapi.com:5035";

const PROTO_DIR = path.join(
  process.cwd(),
  "openapi-proto-messages"
);

// ============================================================
// MAIN
// ============================================================

async function main() {

  console.log("Loading cTrader protobuf...");

  // ==========================================================
  // CHECK PROTO DIRECTORY
  // ==========================================================

  if (!fs.existsSync(PROTO_DIR)) {
    throw new Error(
      `Proto directory not found: ${PROTO_DIR}`
    );
  }

  const protoFiles = fs
    .readdirSync(PROTO_DIR)
    .filter((file) => file.endsWith(".proto"))
    .map((file) => path.join(PROTO_DIR, file));

  console.log("Proto files found.");

  if (protoFiles.length === 0) {
    throw new Error(
      "No protobuf files found."
    );
  }

  // ==========================================================
  // LOAD PROTOBUF
  // ==========================================================

  const root = await protobuf.load(protoFiles);

  console.log("PROTOBUF LOAD SUCCESS");

  // ==========================================================
  // MESSAGE TYPES
  // ==========================================================

  const ProtoMessage =
    root.lookupType("ProtoMessage");

  const ApplicationAuthReq =
    root.lookupType(
      "ProtoOAApplicationAuthReq"
    );

  const AccountAuthReq =
    root.lookupType(
      "ProtoOAAccountAuthReq"
    );

  const AccountAuthRes =
    root.lookupType(
      "ProtoOAAccountAuthRes"
    );

  const GetAccountsReq =
    root.lookupType(
      "ProtoOAGetAccountListByAccessTokenReq"
    );

  const GetAccountsRes =
    root.lookupType(
      "ProtoOAGetAccountListByAccessTokenRes"
    );

  const TraderReq =
    root.lookupType(
      "ProtoOATraderReq"
    );

  const TraderRes =
    root.lookupType(
      "ProtoOATraderRes"
    );

  const SymbolsListReq =
    root.lookupType(
      "ProtoOASymbolsListReq"
    );

  const SymbolsListRes =
    root.lookupType(
      "ProtoOASymbolsListRes"
    );

  const SubscribeSpotsReq =
    root.lookupType(
      "ProtoOASubscribeSpotsReq"
    );

  const SubscribeSpotsRes =
    root.lookupType(
      "ProtoOASubscribeSpotsRes"
    );

  const SpotEvent =
    root.lookupType(
      "ProtoOASpotEvent"
    );

  // IMPORTANT:
  // 2142 is ProtoOAErrorRes
  const ProtoOAErrorRes =
    root.lookupType(
      "ProtoOAErrorRes"
    );

  const ReconcileRes =
    root.lookupType(
      "ProtoOAReconcileRes"
    );

  console.log("All protobuf types loaded");
  console.log("ProtoMessage loaded");
  console.log("Trader type loaded");
  console.log("Reconcile type loaded");
  console.log("Symbols type loaded");
  console.log("Spot subscription type loaded");
  console.log("Spot event type loaded");
  console.log("ProtoOA error response loaded");

  // ==========================================================
  // PAYLOAD ENUMS
  // ==========================================================

  const PayloadType =
    root.lookupEnum(
      "ProtoOAPayloadType"
    ).values;

  const CommonPayloadType =
    root.lookupEnum(
      "ProtoPayloadType"
    ).values;

  // ==========================================================
  // PAYLOAD TYPES
  // ==========================================================

  const APP_AUTH_REQ =
    PayloadType.PROTO_OA_APPLICATION_AUTH_REQ;

  const APP_AUTH_RES =
    PayloadType.PROTO_OA_APPLICATION_AUTH_RES;

  const ACCOUNT_AUTH_REQ =
    PayloadType.PROTO_OA_ACCOUNT_AUTH_REQ;

  const ACCOUNT_AUTH_RES =
    PayloadType.PROTO_OA_ACCOUNT_AUTH_RES;

  // These were confirmed from your protobuf.
  const GET_ACCOUNTS_REQ = 2149;
  const GET_ACCOUNTS_RES = 2150;

  const TRADER_REQ =
    PayloadType.PROTO_OA_TRADER_REQ;

  const TRADER_RES =
    PayloadType.PROTO_OA_TRADER_RES;

  const SYMBOLS_LIST_REQ =
    PayloadType.PROTO_OA_SYMBOLS_LIST_REQ;

  const SYMBOLS_LIST_RES =
    PayloadType.PROTO_OA_SYMBOLS_LIST_RES;

  const RECONCILE_RES =
    PayloadType.PROTO_OA_RECONCILE_RES;

  const SUBSCRIBE_SPOTS_REQ =
    PayloadType.PROTO_OA_SUBSCRIBE_SPOTS_REQ;

  const SUBSCRIBE_SPOTS_RES =
    PayloadType.PROTO_OA_SUBSCRIBE_SPOTS_RES;

  const SPOT_EVENT =
    PayloadType.PROTO_OA_SPOT_EVENT;

  // Official cTrader ProtoOA error payload.
  const ERROR_RES =
    PayloadType.PROTO_OA_ERROR_RES;

  // Fallback in case local proto enum is missing it.
  const FINAL_ERROR_RES =
    ERROR_RES ?? 2142;

  // ==========================================================
  // PRINT PAYLOAD TYPES
  // ==========================================================

  console.log("");
  console.log("Payload Types:");
  console.log({
    APP_AUTH_REQ,
    APP_AUTH_RES,
    ACCOUNT_AUTH_REQ,
    ACCOUNT_AUTH_RES,
    GET_ACCOUNTS_REQ,
    GET_ACCOUNTS_RES,
    TRADER_REQ,
    TRADER_RES,
    SYMBOLS_LIST_REQ,
    SYMBOLS_LIST_RES,
    RECONCILE_RES,
    SUBSCRIBE_SPOTS_REQ,
    SUBSCRIBE_SPOTS_RES,
    SPOT_EVENT,
    ERROR_RES: FINAL_ERROR_RES
  });

  // ==========================================================
  // VALIDATE
  // ==========================================================

  const payloadTypes = {
    APP_AUTH_REQ,
    APP_AUTH_RES,
    ACCOUNT_AUTH_REQ,
    ACCOUNT_AUTH_RES,
    GET_ACCOUNTS_REQ,
    GET_ACCOUNTS_RES,
    TRADER_REQ,
    TRADER_RES,
    SYMBOLS_LIST_REQ,
    SYMBOLS_LIST_RES,
    RECONCILE_RES,
    SUBSCRIBE_SPOTS_REQ,
    SUBSCRIBE_SPOTS_RES,
    SPOT_EVENT
  };

  for (
    const [name, value]
    of Object.entries(payloadTypes)
  ) {

    if (
      value === undefined ||
      value === null
    ) {

      throw new Error(
        `Payload type is undefined: ${name}`
      );

    }

  }

  // ==========================================================
  // ENVIRONMENT
  // ==========================================================

  const clientId =
    process.env.CTRADER_CLIENT_ID;

  const clientSecret =
    process.env.CTRADER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {

    throw new Error(
      "Missing CTRADER_CLIENT_ID or CTRADER_CLIENT_SECRET"
    );

  }

  console.log("");
  console.log(
    "Client ID exists:",
    Boolean(clientId)
  );

  console.log(
    "Client Secret exists:",
    Boolean(clientSecret)
  );

  // ==========================================================
  // GET OAUTH TOKEN
  // ==========================================================

  console.log("");
  console.log(
    "Getting OAuth access token from EdgeFlo server..."
  );

  const debugResponse =
    await fetch(
      "http://localhost:4000/api/ctrader/debug-token"
    );

  if (!debugResponse.ok) {

    throw new Error(
      `OAuth debug endpoint returned HTTP ${debugResponse.status}`
    );

  }

  const debugData =
    await debugResponse.json();

  if (!debugData.success) {

    throw new Error(
      debugData.message ||
      "cTrader OAuth is not connected"
    );

  }

  const accessToken =
    debugData.accessToken;

  console.log(
    "OAuth connection verified"
  );

  console.log(
    "OAuth Account ID:",
    debugData.accountId
  );

  console.log(
    "Access Token: AVAILABLE"
  );

  if (!accessToken) {

    throw new Error(
      "Access token unavailable"
    );

  }

  // ==========================================================
  // WEBSOCKET
  // ==========================================================

  console.log("");
  console.log(
    "Connecting to cTrader WebSocket..."
  );

  const ws =
    new WebSocket(WS_URL);

  // ==========================================================
  // IMPORTANT STATE
  // ==========================================================

  // This will contain the REAL cTrader trading account ID.
  let selectedTradingAccountId = null;

  let selectedSymbolId = null;

  let selectedSymbolName = null;

  // ==========================================================
  // SEND MESSAGE
  // ==========================================================

  function sendMessage(
    payloadType,
    payload,
    clientMsgId
  ) {

    if (
      payloadType === undefined ||
      payloadType === null
    ) {

      throw new Error(
        `Cannot send undefined payload type: ${clientMsgId}`
      );

    }

    const message =
      ProtoMessage.create({
        payloadType,
        payload,
        clientMsgId
      });

    const buffer =
      ProtoMessage
        .encode(message)
        .finish();

    console.log(
      `Sending payload ${payloadType}, bytes: ${buffer.length}`
    );

    ws.send(buffer);
  }

  // ==========================================================
  // WEBSOCKET OPEN
  // ==========================================================

  ws.on("open", () => {

    console.log("");
    console.log(
      "===================================="
    );
    console.log(
      "WEBSOCKET CONNECTED"
    );
    console.log(
      "===================================="
    );

    console.log(
      "WebSocket URL:",
      WS_URL
    );

    // ========================================================
    // APPLICATION AUTH
    // ========================================================

    const authPayload =
      ApplicationAuthReq.create({
        clientId,
        clientSecret
      });

    const authBuffer =
      ApplicationAuthReq
        .encode(authPayload)
        .finish();

    console.log(
      "Sending Application Auth..."
    );

    sendMessage(
      APP_AUTH_REQ,
      authBuffer,
      "edgeflo-app-auth-1"
    );

  });

  // ==========================================================
  // MESSAGE RECEIVED
  // ==========================================================

  ws.on("message", (data) => {

    try {

      const bytes =
        new Uint8Array(data);

      const outer =
        ProtoMessage.decode(bytes);

      const payloadType =
        Number(
          outer.payloadType
        );

      console.log("");
      console.log(
        "===================================="
      );
      console.log(
        "MESSAGE RECEIVED"
      );
      console.log(
        "===================================="
      );

      console.log(
        "Payload Type:",
        payloadType
      );

      console.log(
        "Client Message ID:",
        outer.clientMsgId || "(none)"
      );

      // ======================================================
      // HEARTBEAT
      // ======================================================

      if (
        payloadType === 51
      ) {

        console.log(
          "Heartbeat received."
        );

        return;

      }

      // ======================================================
      // APPLICATION AUTH SUCCESS
      // ======================================================

      if (
        payloadType === APP_AUTH_RES
      ) {

        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "APPLICATION AUTH SUCCESS"
        );
        console.log(
          "===================================="
        );

        console.log(
          "Application authenticated."
        );

        // ====================================================
        // GET ACCOUNTS
        // ====================================================

        console.log("");
        console.log(
          "GETTING ACCOUNTS FROM ACCESS TOKEN"
        );

        const request =
          GetAccountsReq.create({
            accessToken
          });

        const payload =
          GetAccountsReq
            .encode(request)
            .finish();

        console.log(
          "Request payload bytes:",
          payload.length
        );

        sendMessage(
          GET_ACCOUNTS_REQ,
          payload,
          "edgeflo-get-accounts-1"
        );

        return;
      }

      // ======================================================
      // GET ACCOUNTS RESPONSE
      // ======================================================

      if (
        payloadType === GET_ACCOUNTS_RES
      ) {

        const response =
          GetAccountsRes.decode(
            outer.payload
          );

        const accounts =
          response.ctidTraderAccount || [];

        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "AUTHORIZED ACCOUNTS RECEIVED"
        );
        console.log(
          "===================================="
        );

        console.log(
          "Number of accounts:",
          accounts.length
        );

        if (
          accounts.length === 0
        ) {

          throw new Error(
            "No authorized trading accounts found."
          );

        }

        // ====================================================
        // SELECT ACCOUNT
        // ====================================================

        const account =
          accounts[0];

        // IMPORTANT:
        // THIS is the actual trading account ID.
        selectedTradingAccountId =
          account.ctidTraderAccountId;

        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "TRADING ACCOUNT SELECTED"
        );
        console.log(
          "===================================="
        );

        console.log(
          "Trading Account ID:",
          selectedTradingAccountId.toString()
        );

        console.log(
          "Broker:",
          account.brokerTitle ||
          account.brokerTitleShort ||
          "(unknown)"
        );

        console.log(
          "Trader Login:",
          account.traderLogin?.toString()
        );

        console.log(
          "Is Live:",
          account.isLive
        );

        // ====================================================
        // ACCOUNT AUTH
        // ====================================================

        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "AUTHENTICATING TRADING ACCOUNT"
        );
        console.log(
          "===================================="
        );

        const accountAuth =
          AccountAuthReq.create({
            ctidTraderAccountId:
              selectedTradingAccountId,

            accessToken
          });

        const accountAuthPayload =
          AccountAuthReq
            .encode(accountAuth)
            .finish();

        console.log(
          "Account Auth payload bytes:",
          accountAuthPayload.length
        );

        sendMessage(
          ACCOUNT_AUTH_REQ,
          accountAuthPayload,
          "edgeflo-account-auth-1"
        );

        return;
      }

      // ======================================================
      // ACCOUNT AUTH SUCCESS
      // ======================================================

      if (
        payloadType === ACCOUNT_AUTH_RES
      ) {

        const response =
          AccountAuthRes.decode(
            outer.payload
          );

        // ====================================================
        // CRITICAL FIX
        // ====================================================
        //
        // DO NOT USE:
        //
        // debugData.accountId
        //
        // USE:
        //
        // response.ctidTraderAccountId
        //
        // ====================================================

        selectedTradingAccountId =
          response.ctidTraderAccountId;

        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "ACCOUNT AUTHENTICATION SUCCESS"
        );
        console.log(
          "===================================="
        );

        console.log(
          "Authenticated Trading Account ID:",
          selectedTradingAccountId.toString()
        );

        console.log(
          "OAuth Account ID:",
          debugData.accountId
        );

        // ====================================================
        // TRADER REQUEST
        // ====================================================

        const traderRequest =
          TraderReq.create({
            ctidTraderAccountId:
              selectedTradingAccountId
          });

        const traderPayload =
          TraderReq
            .encode(traderRequest)
            .finish();

        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "REQUESTING TRADER ACCOUNT INFO"
        );
        console.log(
          "===================================="
        );

        console.log(
          "Using Trading Account ID:",
          selectedTradingAccountId.toString()
        );

        console.log(
          "Trader request payload bytes:",
          traderPayload.length
        );

        sendMessage(
          TRADER_REQ,
          traderPayload,
          "edgeflo-trader-info-1"
        );

        return;
      }

      // ======================================================
      // TRADER RESPONSE
      // ======================================================

      if (
        payloadType === TRADER_RES
      ) {

        const response =
          TraderRes.decode(
            outer.payload
          );

        const trader =
          response.trader;

        if (!trader) {

          throw new Error(
            "Trader object missing from TraderRes."
          );

        }

        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "TRADER ACCOUNT INFO RECEIVED"
        );
        console.log(
          "===================================="
        );

        console.log(
          "Trading Account ID:",
          response.ctidTraderAccountId.toString()
        );

        console.log(
          "Trader Account ID:",
          trader.ctidTraderAccountId.toString()
        );

        console.log(
          "Trader Login:",
          trader.traderLogin?.toString()
        );

        // ====================================================
        // BALANCE
        // ====================================================

        const moneyDigits =
          Number(
            trader.moneyDigits || 0
          );

        const rawBalance =
          Number(
            trader.balance.toString()
          );

        const actualBalance =
          rawBalance /
          Math.pow(
            10,
            moneyDigits
          );

        console.log(
          "Raw Balance:",
          rawBalance
        );

        console.log(
          "Money Digits:",
          moneyDigits
        );

        console.log(
          "Actual Balance:",
          actualBalance
        );

        console.log(
          "Deposit Asset ID:",
          trader.depositAssetId?.toString()
        );

        console.log(
          "Leverage:",
          Number(
            trader.leverageInCents || 0
          ) / 100
        );

        console.log(
          "Broker:",
          trader.brokerName
        );

        // ====================================================
        // SYMBOL LIST
        // ====================================================

        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "REQUESTING AVAILABLE SYMBOLS"
        );
        console.log(
          "===================================="
        );

        const symbolsRequest =
          SymbolsListReq.create({
            ctidTraderAccountId:
              selectedTradingAccountId,

            includeArchivedSymbols:
              false
          });

        const symbolsPayload =
          SymbolsListReq
            .encode(symbolsRequest)
            .finish();

        console.log(
          "Symbols request payload bytes:",
          symbolsPayload.length
        );

        sendMessage(
          SYMBOLS_LIST_REQ,
          symbolsPayload,
          "edgeflo-symbols-list-1"
        );

        return;
      }

      // ======================================================
      // SYMBOL LIST RESPONSE
      // ======================================================

      if (
        payloadType === SYMBOLS_LIST_RES
      ) {

        const response =
          SymbolsListRes.decode(
            outer.payload
          );

        const symbols =
          response.symbol || [];

        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "SYMBOL DISCOVERY SUCCESS"
        );
        console.log(
          "===================================="
        );

        console.log(
          "Trading Account ID:",
          selectedTradingAccountId?.toString()
        );

        console.log(
          "Total Symbols:",
          symbols.length
        );

        console.log("");
        console.log(
          "AVAILABLE SYMBOLS:"
        );

        symbols
          .slice(0, 50)
          .forEach(
            (symbol, index) => {

              console.log(
                `${index + 1}. ${
                  symbol.symbolName
                } | ID: ${
                  symbol.symbolId.toString()
                } | Enabled: ${
                  symbol.enabled
                }`
              );

            }
          );

        // ====================================================
        // FIND EURUSD
        // ====================================================

        const eurusd =
          symbols.find(
            (symbol) => {

              const name =
                String(
                  symbol.symbolName || ""
                )
                  .toUpperCase()
                  .replace(
                    /[^A-Z]/g,
                    ""
                  );

              return (
                name === "EURUSD"
              );

            }
          );

        if (!eurusd) {

          console.log("");
          console.log(
            "===================================="
          );
          console.log(
            "EURUSD NOT FOUND"
          );
          console.log(
            "===================================="
          );

          console.log(
            "Search one of the symbols above."
          );

          return;
        }

        // ====================================================
        // SAVE EURUSD
        // ====================================================

        selectedSymbolId =
          eurusd.symbolId;

        selectedSymbolName =
          eurusd.symbolName;

        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "EURUSD FOUND"
        );
        console.log(
          "===================================="
        );

        console.log(
          "Symbol:",
          selectedSymbolName
        );

        console.log(
          "Symbol ID:",
          selectedSymbolId.toString()
        );

        console.log(
          "Enabled:",
          eurusd.enabled
        );

        // ====================================================
        // SUBSCRIBE TO SPOTS
        // ====================================================

        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "SUBSCRIBING TO EURUSD LIVE PRICE"
        );
        console.log(
          "===================================="
        );

        const subscribeRequest =
          SubscribeSpotsReq.create({

            ctidTraderAccountId:
              selectedTradingAccountId,

            symbolId: [
              selectedSymbolId
            ],

            subscribeToSpotTimestamp:
              true

          });

        const subscribePayload =
          SubscribeSpotsReq
            .encode(
              subscribeRequest
            )
            .finish();

        console.log(
          "Subscribe payload bytes:",
          subscribePayload.length
        );

        sendMessage(
          SUBSCRIBE_SPOTS_REQ,
          subscribePayload,
          "edgeflo-subscribe-eurusd-1"
        );

        return;
      }

      // ======================================================
      // SUBSCRIBE RESPONSE
      // ======================================================

      if (
        payloadType === SUBSCRIBE_SPOTS_RES
      ) {

        const response =
          SubscribeSpotsRes.decode(
            outer.payload
          );

        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "LIVE PRICE SUBSCRIPTION SUCCESS"
        );
        console.log(
          "===================================="
        );

        console.log(
          "Trading Account ID:",
          selectedTradingAccountId?.toString()
        );

        console.log(
          "Symbol:",
          selectedSymbolName
        );

        console.log(
          "Symbol ID:",
          selectedSymbolId?.toString()
        );

        console.log(
          "cTrader accepted the subscription."
        );

        console.log(
          "Waiting for live Spot Events..."
        );

        return;
      }

      // ======================================================
      // SPOT EVENT
      // ======================================================

      if (
        payloadType === SPOT_EVENT
      ) {

        const spot =
          SpotEvent.decode(
            outer.payload
          );

        const symbolId =
          spot.symbolId?.toString();

        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "LIVE MARKET PRICE"
        );
        console.log(
          "===================================="
        );

        console.log(
          "Symbol:",
          selectedSymbolName
        );

        console.log(
          "Symbol ID:",
          symbolId
        );

        // ====================================================
        // BID
        // ====================================================

        let bid = null;
        let ask = null;

        if (
          spot.bid !== undefined &&
          spot.bid !== null
        ) {

          bid =
            Number(
              spot.bid.toString()
            ) / 100000;

          console.log(
            "BID:",
            bid
          );

        }

        // ====================================================
        // ASK
        // ====================================================

        if (
          spot.ask !== undefined &&
          spot.ask !== null
        ) {

          ask =
            Number(
              spot.ask.toString()
            ) / 100000;

          console.log(
            "ASK:",
            ask
          );

        }

        // ====================================================
        // MID
        // ====================================================

        if (
          bid !== null &&
          ask !== null
        ) {

          const mid =
            (bid + ask) / 2;

          console.log(
            "MID:",
            mid
          );

        }

        // ====================================================
        // TIMESTAMP
        // ====================================================

        if (
          spot.timestamp !== undefined &&
          spot.timestamp !== null
        ) {

          console.log(
            "Timestamp:",
            spot.timestamp.toString()
          );

        }

        console.log(
          "===================================="
        );

        return;
      }

      // ======================================================
      // RECONCILE RESPONSE
      // ======================================================

      if (
        payloadType === RECONCILE_RES
      ) {

        const response =
          ReconcileRes.decode(
            outer.payload
          );

        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "RECONCILE RESPONSE"
        );
        console.log(
          "===================================="
        );

        console.log(
          "Positions:",
          (
            response.position || []
          ).length
        );

        console.log(
          "Orders:",
          (
            response.order || []
          ).length
        );

        return;
      }

      // ======================================================
      // CTRADER ERROR
      // ======================================================

      if (
        payloadType === FINAL_ERROR_RES
      ) {

        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "CTRADER API ERROR"
        );
        console.log(
          "===================================="
        );

        try {

          const errorResponse =
            ProtoOAErrorRes.decode(
              outer.payload
            );

          console.log(
            "Error Code:",
            errorResponse.errorCode
          );

          console.log(
            "Description:",
            errorResponse.description ||
            "(no description)"
          );

          if (
            errorResponse.ctidTraderAccountId
          ) {

            console.log(
              "Error Account ID:",
              errorResponse
                .ctidTraderAccountId
                .toString()
            );

          }

          if (
            errorResponse.retryAfter
          ) {

            console.log(
              "Retry After:",
              errorResponse
                .retryAfter
                .toString(),
              "seconds"
            );

          }

        } catch (error) {

          console.log(
            "Could not decode ProtoOAErrorRes:"
          );

          console.log(
            error.message
          );

        }

        console.log(
          "===================================="
        );

        return;
      }

      // ======================================================
      // UNKNOWN PAYLOAD
      // ======================================================

      console.log("");
      console.log(
        "Unhandled Payload Type:",
        payloadType
      );

    } catch (error) {

      console.error("");
      console.error(
        "===================================="
      );
      console.error(
        "MESSAGE PROCESSING ERROR"
      );
      console.error(
        "===================================="
      );

      console.error(
        error
      );

    }

  });

  // ==========================================================
  // WEBSOCKET ERROR
  // ==========================================================

  ws.on("error", (error) => {

    console.log("");
    console.log(
      "===================================="
    );
    console.log(
      "WEBSOCKET ERROR"
    );
    console.log(
      "===================================="
    );

    console.error(
      error.message
    );

  });

  // ==========================================================
  // WEBSOCKET CLOSE
  // ==========================================================

  ws.on("close", (code, reason) => {

    console.log("");
    console.log(
      "===================================="
    );
    console.log(
      "WEBSOCKET CLOSED"
    );
    console.log(
      "===================================="
    );

    console.log(
      "Code:",
      code
    );

    console.log(
      "Reason:",
      reason?.toString() || ""
    );

  });

  // ==========================================================
  // WEBSOCKET PING/PONG
  // ==========================================================

  ws.on("ping", () => {

    console.log(
      "WebSocket ping received."
    );

  });

  ws.on("pong", () => {

    console.log(
      "WebSocket pong received."
    );

  });

}

// ============================================================
// START
// ============================================================

main().catch((error) => {

  console.log("");
  console.log(
    "===================================="
  );

  console.log(
    "TEST ERROR"
  );

  console.log(
    "===================================="
  );

  console.error(
    error
  );

});