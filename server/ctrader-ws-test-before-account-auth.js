import "dotenv/config";
import WebSocket from "ws";
import protobuf from "protobufjs";

const WS_URL = "wss://demo.ctraderapi.com:5035";

const PROTO_DIR = "./openapi-proto-messages";

// cTrader Payload Types
const APP_AUTH_REQ = 2100;
const APP_AUTH_RES = 2101;

const GET_ACCOUNTS_REQ = 2149;
const GET_ACCOUNTS_RES = 2150;

const ERROR_RES = 2142;

async function main() {
  console.log("Loading cTrader protobuf...");

  const root = await protobuf.load([
    `${PROTO_DIR}/OpenApiCommonMessages.proto`,
    `${PROTO_DIR}/OpenApiCommonModelMessages.proto`,
    `${PROTO_DIR}/OpenApiModelMessages.proto`,
    `${PROTO_DIR}/OpenApiMessages.proto`,
  ]);

  console.log("PROTOBUF LOAD SUCCESS");

  // ==========================================
  // PROTOBUF TYPES
  // ==========================================

  const ProtoMessage =
    root.lookupType("ProtoMessage");

  const ApplicationAuthReq =
    root.lookupType("ProtoOAApplicationAuthReq");

  const ApplicationAuthRes =
    root.lookupType("ProtoOAApplicationAuthRes");

  const GetAccountsReq =
    root.lookupType(
      "ProtoOAGetAccountListByAccessTokenReq"
    );

  const GetAccountsRes =
    root.lookupType(
      "ProtoOAGetAccountListByAccessTokenRes"
    );

  const ProtoErrorRes =
    root.lookupType("ProtoErrorRes");

  console.log("All protobuf types loaded");
  console.log("Error response type loaded");

  // ==========================================
  // ENVIRONMENT
  // ==========================================

  const clientId =
    process.env.CTRADER_CLIENT_ID;

  const clientSecret =
    process.env.CTRADER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing CTRADER_CLIENT_ID or CTRADER_CLIENT_SECRET"
    );
  }

  console.log(
    "Client ID exists:",
    Boolean(clientId)
  );

  console.log(
    "Client Secret exists:",
    Boolean(clientSecret)
  );

  // ==========================================
  // GET OAUTH TOKEN FROM EDGEFLO SERVER
  // ==========================================

  console.log("");
  console.log(
    "Getting OAuth access token from EdgeFlo server..."
  );

  const debugResponse = await fetch(
    "http://localhost:4000/api/ctrader/debug-token"
  );

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
    "Account ID:",
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

  // ==========================================
  // CONNECT WEBSOCKET
  // ==========================================

  console.log("");
  console.log(
    "Connecting to cTrader WebSocket..."
  );

  const ws =
    new WebSocket(WS_URL);

  // ==========================================
  // WEBSOCKET OPEN
  // ==========================================

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

    // ========================================
    // APPLICATION AUTH
    // ========================================

    const authPayload =
      ApplicationAuthReq.create({
        clientId,
        clientSecret,
      });

    const authPayloadBuffer =
      ApplicationAuthReq
        .encode(authPayload)
        .finish();

    const authMessage =
      ProtoMessage.create({
        payloadType: APP_AUTH_REQ,
        payload: authPayloadBuffer,
        clientMsgId:
          "edgeflo-app-auth-1",
      });

    const authBuffer =
      ProtoMessage
        .encode(authMessage)
        .finish();

    console.log(
      "Sending Application Auth..."
    );

    ws.send(authBuffer);
  });

  // ==========================================
  // MESSAGE RECEIVED
  // ==========================================

  ws.on("message", (data) => {
    try {
      const outer =
        ProtoMessage.decode(
          new Uint8Array(data)
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
        outer.payloadType
      );

      console.log(
        "Client Message ID:",
        outer.clientMsgId || "(none)"
      );

      // ======================================
      // APPLICATION AUTH SUCCESS
      // ======================================

      if (
        outer.payloadType ===
        APP_AUTH_RES
      ) {
        ApplicationAuthRes.decode(
          outer.payload
        );

        console.log("");
        console.log(
          "APPLICATION AUTH SUCCESS"
        );

        console.log(
          "Application authenticated."
        );

        // ====================================
        // GET ACCOUNTS USING ACCESS TOKEN
        // ====================================

        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "GETTING ACCOUNTS FROM ACCESS TOKEN"
        );
        console.log(
          "===================================="
        );

        const request =
          GetAccountsReq.create({
            accessToken,
          });

        const payload =
          GetAccountsReq
            .encode(request)
            .finish();

        const message =
          ProtoMessage.create({
            payloadType:
              GET_ACCOUNTS_REQ,

            payload,

            clientMsgId:
              "edgeflo-get-accounts-1",
          });

        const buffer =
          ProtoMessage
            .encode(message)
            .finish();

        console.log(
          "Request payload bytes:",
          payload.length
        );

        console.log(
          "Sending Get Accounts By Access Token..."
        );

        ws.send(buffer);

        return;
      }

      // ======================================
      // GET ACCOUNTS RESPONSE
      // ======================================

      if (
        outer.payloadType ===
        GET_ACCOUNTS_RES
      ) {
        const response =
          GetAccountsRes.decode(
            outer.payload
          );

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

        const accounts =
          response.ctidTraderAccount || [];

        console.log(
          "Number of accounts:",
          accounts.length
        );

        accounts.forEach(
          (account, index) => {
            console.log("");
            console.log(
              `ACCOUNT ${index + 1}`
            );

            console.log(
              "Account ID:",
              account.ctidTraderAccountId?.toString()
            );

            console.log(
              "Broker:",
              account.brokerTitle ||
                "(not provided)"
            );

            console.log(
              "Trader Login:",
              account.traderLogin?.toString()
            );

            console.log(
              "Is Live:",
              account.isLive
            );

            console.log(
              "Full Account Object:",
              account
            );
          }
        );

        console.log("");
        console.log(
          "===================================="
        );

        console.log(
          "🎉 cTrader OAuth + WebSocket working!"
        );

        console.log(
          "Authorized account discovery completed."
        );

        console.log(
          "===================================="
        );

        // Keep connection open for inspection.
        return;
      }

      // ======================================
      // CTRADER ERROR
      // ======================================

      if (
        outer.payloadType ===
        ERROR_RES
      ) {
        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "CTRADER ERROR RESPONSE"
        );
        console.log(
          "===================================="
        );

        console.log(
          "Raw Error Payload HEX:",
          Buffer.from(
            outer.payload || []
          ).toString("hex")
        );

        try {
          const errorResponse =
            ProtoErrorRes.decode(
              outer.payload
            );

          console.log(
            "Error Code:",
            errorResponse.errorCode
          );

          console.log(
            "Description:",
            errorResponse.description
          );
        } catch (error) {
          console.log(
            "Could not decode error:",
            error.message
          );
        }

        console.log(
          "===================================="
        );

        return;
      }

      // ======================================
      // UNKNOWN PAYLOAD
      // ======================================

      console.log(
        "Unhandled Payload Type:",
        outer.payloadType
      );

    } catch (error) {
      console.error("");
      console.error(
        "MESSAGE PROCESSING ERROR"
      );
      console.error(error);
    }
  });

  // ==========================================
  // WEBSOCKET ERROR
  // ==========================================

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

  // ==========================================
  // WEBSOCKET CLOSE
  // ==========================================

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
}

// ==========================================
// START
// ==========================================

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

  console.error(error);
});