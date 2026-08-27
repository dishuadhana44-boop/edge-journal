import WebSocket from "ws";
import protobuf from "protobufjs";

const WS_URL = "wss://demo.ctraderapi.com:5036";

const PROTO_FILES = [
  "./openapi-proto-messages/OpenApiCommonMessages.proto",
  "./openapi-proto-messages/OpenApiCommonModelMessages.proto",
  "./openapi-proto-messages/OpenApiModelMessages.proto",
  "./openapi-proto-messages/OpenApiMessages.proto",
];

let root = null;
let ws = null;

async function loadProto() {
  if (!root) {
    root = await protobuf.load(PROTO_FILES);
  }

  return root;
}

function getType(name) {
  return root.lookupType(name);
}

async function connectSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return ws;
  }

  return new Promise((resolve, reject) => {
    ws = new WebSocket(WS_URL);

    ws.once("open", () => {
      console.log("cTrader WebSocket connected");
      resolve(ws);
    });

    ws.once("error", reject);

    ws.on("close", (code, reason) => {
      console.log(
        "cTrader WebSocket closed:",
        code,
        reason?.toString() || ""
      );

      ws = null;
    });
  });
}

function createMessage(payloadTypeName, payloadData) {
  const PayloadType = getType(payloadTypeName);
  const ProtoMessage = getType("ProtoMessage");

  const payload = PayloadType.create(payloadData);
  const payloadBuffer = PayloadType.encode(payload).finish();

  const payloadType =
    PayloadType.lookupEnum("ProtoOAPayloadType");

  const typeNumber =
    payloadType.values[payloadTypeName];

  const message = ProtoMessage.create({
    payloadType: typeNumber,
    payload: payloadBuffer,
  });

  return ProtoMessage.encode(message).finish();
}

export async function getAccountsByAccessToken(accessToken) {
  if (!accessToken) {
    throw new Error("cTrader access token is required");
  }

  await loadProto();

  const socket = await connectSocket();

  return new Promise((resolve, reject) => {
    const ProtoMessage = getType("ProtoMessage");
    const ResponseType = getType(
      "ProtoOAGetAccountListByAccessTokenRes"
    );

    const request = createMessage(
      "ProtoOAGetAccountListByAccessTokenReq",
      {
        accessToken,
      }
    );

    const timeout = setTimeout(() => {
      reject(
        new Error(
          "cTrader account list request timed out"
        )
      );
    }, 10000);

    const onMessage = (data) => {
      try {
        const message = ProtoMessage.decode(
          new Uint8Array(data)
        );

        const response = ResponseType.decode(
          message.payload
        );

        clearTimeout(timeout);

        socket.off("message", onMessage);

        resolve(response);
      } catch (error) {
        // Ignore messages that belong to another request.
      }
    };

    socket.on("message", onMessage);

    socket.send(request);
  });
}

export async function closeCTrader() {
  if (ws) {
    ws.close();
    ws = null;
  }
}