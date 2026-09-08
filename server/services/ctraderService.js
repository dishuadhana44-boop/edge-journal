import fs from "fs";
import path from "path";
import protobuf from "protobufjs";
import WebSocket from "ws";
import dotenv from "dotenv";

dotenv.config();

// ============================================================
// CONFIG
// ============================================================

const WS_URL = "wss://demo.ctraderapi.com:5035";

const PROTO_DIR = path.join(
  process.cwd(),
  "openapi-proto-messages"
);

// cTrader volume values are represented in 0.01 units.
// The broker-provided lotSize, minVolume, maxVolume and
// stepVolume are already in cTrader protocol volume format.

// ============================================================
// SERVICE STATE
// ============================================================

let ws = null;

let running = false;
let connected = false;
let authenticated = false;
let serviceReady = false;

// ============================================================
// ACCOUNT STATE
// ============================================================

let selectedTradingAccountId = null;

const accountsMap = new Map();

let accountInfo = {
  accountId: null,
  balance: null,
  equity: null,
  margin: null,
  freeMargin: null,
  currency: null,
  leverage: null,
  brokerName: null,
};

// ============================================================
// SYMBOL STATE
// ============================================================

let selectedSymbolId = null;
let selectedSymbolName = null;

let selectedSymbolVolumeMin = null;
let selectedSymbolVolumeMax = null;
let selectedSymbolVolumeStep = null;
let selectedSymbolLotSize = null;

let selectedSymbolDigits = 5;

// ============================================================
// SYMBOL STORAGE
// ============================================================

// Key:
// normalized symbol name
//
// Example:
// EURUSD
// XAUUSD
// GBPUSD

const symbolsMap = new Map();

// Key:
// symbolId as string

const symbolsById = new Map();

// ============================================================
// SUBSCRIBED SYMBOLS
// ============================================================

const subscribedSymbols = new Set();

// ============================================================
// PRICE CACHE
// ============================================================

const latestPrices = new Map();

// ============================================================
// SYMBOL REQUEST WAITERS
// ============================================================

// Used when requesting full symbol data.

const symbolRequestWaiters = new Map();

// ============================================================
// STARTUP STATE
// ============================================================

let startupPromise = null;
let startupResolve = null;
let startupReject = null;

// ============================================================
// CALLBACKS
// ============================================================

let onPriceUpdate = null;
let onExecutionUpdate = null;

// ============================================================
// MESSAGE SENDER
// ============================================================

let sendCTraderMessage = null;

// ============================================================
// PROTOBUF TYPES
// ============================================================

let ProtoMessage = null;

let ApplicationAuthReq = null;

let GetAccountsReq = null;
let GetAccountsRes = null;

let AccountAuthReq = null;
let AccountAuthRes = null;

let TraderReq = null;
let TraderRes = null;

let SymbolsListReq = null;
let SymbolsListRes = null;

let SymbolByIdReq = null;
let SymbolByIdRes = null;

let SubscribeSpotsReq = null;

let SpotEvent = null;

let NewOrderReq = null;

let ClosePositionReq = null;

let ExecutionEvent = null;

let OrderErrorEvent = null;

let AmendPositionSLTPReq = null;

// ============================================================
// PAYLOAD TYPES
// ============================================================

let PAYLOAD = {};

// ============================================================
// ENUMS
// ============================================================

let ORDER_TYPE = {};

let TRADE_SIDE = {};

// ============================================================
// HELPERS
// ============================================================

function toStringSafe(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  return value.toString();
}

function toNumberSafe(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const number = Number(
    value.toString()
  );

  return Number.isFinite(number)
    ? number
    : null;
}

function normalizePrice(price) {
  if (
    price === undefined ||
    price === null ||
    price === ""
  ) {
    return null;
  }

  const numericPrice = Number(price);

  return Number.isFinite(numericPrice)
    ? numericPrice
    : null;
}

function normalizeSymbolName(symbol) {
  if (!symbol) return "";

  return String(symbol)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function getPriceScale(digits) {
  const numericDigits = Number(digits);

  if (
    !Number.isFinite(numericDigits) ||
    numericDigits < 0
  ) {
    return 100000;
  }

  return Math.pow(
    10,
    numericDigits
  );
}

// ============================================================
// ACCOUNT HELPERS
// ============================================================

function resetAccountInfo() {
  accountInfo = {
    accountId: null,
    balance: null,
    equity: null,
    margin: null,
    freeMargin: null,
    currency: null,
    leverage: null,
    brokerName: null,
  };
}

function buildAccountFromAuthorizedAccount(account) {
  return {
    accountId: toStringSafe(
      account.ctidTraderAccountId
    ),

    isLive:
      account.isLive !== undefined
        ? account.isLive
        : null,

    traderLogin:
      account.traderLogin !== undefined
        ? toStringSafe(
            account.traderLogin
          )
        : null,

    lastLoginTime:
      account.lastLoginTime !== undefined
        ? toStringSafe(
            account.lastLoginTime
          )
        : null,
  };
}

function updateAccountInfoFromTrader(trader) {
  if (!trader) return;

  accountInfo = {
    accountId:
      toStringSafe(
        trader.ctidTraderAccountId
      ) ||
      toStringSafe(
        selectedTradingAccountId
      ),

    balance:
      trader.balance !== undefined
        ? toNumberSafe(trader.balance)
        : null,

    equity:
      trader.equity !== undefined
        ? toNumberSafe(trader.equity)
        : null,

    margin:
      trader.margin !== undefined
        ? toNumberSafe(trader.margin)
        : null,

    freeMargin:
      trader.freeMargin !== undefined
        ? toNumberSafe(
            trader.freeMargin
          )
        : null,

    currency:
      trader.depositCurrency ||
      trader.currency ||
      null,

    leverage:
      trader.leverage !== undefined
        ? toNumberSafe(
            trader.leverage
          )
        : null,

    brokerName:
      trader.brokerName ||
      null,
  };

  console.log("");
  console.log("====================================");
  console.log("💰 ACCOUNT INFORMATION");
  console.log("====================================");

  console.log(accountInfo);
}

// ============================================================
// VOLUME HELPERS
// ============================================================

function getSymbolVolumeStep(symbolData) {
  const step = Number(
    symbolData?.volumeStep ??
    symbolData?.stepVolume
  );

  if (
    !Number.isFinite(step) ||
    step <= 0
  ) {
    return null;
  }

  return Math.round(step);
}

function snapVolumeToStep(volume, step) {
  if (!Number.isFinite(volume)) {
    throw new Error(
      "Invalid calculated volume."
    );
  }

  if (
    !Number.isFinite(step) ||
    step <= 0
  ) {
    throw new Error(
      "Broker volume step is unavailable."
    );
  }

  // Round to nearest valid broker step.
  // This avoids floating-point problems.

  const snapped =
    Math.round(volume / step) * step;

  return Math.round(snapped);
}

// ============================================================
// LOTS → CTRADER PROTOCOL VOLUME
// ============================================================

function lotsToVolume(
  lots,
  symbolData = null
) {
  const numericLots = Number(lots);

  if (
    !Number.isFinite(numericLots) ||
    numericLots <= 0
  ) {
    throw new Error(
      "Invalid lot size."
    );
  }

  if (!symbolData) {
    throw new Error(
      "Symbol trading data is unavailable."
    );
  }

  // IMPORTANT:
  //
  // cTrader ProtoOASymbol.lotSize
  // is already represented in protocol volume units.
  //
  // Therefore:
  //
  // protocolVolume = lots × lotSize
  //
  // NO extra ×100 is required here.

  const lotSize = Number(
    symbolData.lotSize
  );

  if (
    !Number.isFinite(lotSize) ||
    lotSize <= 0
  ) {
    console.error(
      "❌ Missing broker lotSize:",
      symbolData
    );

    throw new Error(
      `Lot size is unavailable for ${symbolData.symbolName}.`
    );
  }

  const volumeStep =
    getSymbolVolumeStep(symbolData);

  if (!volumeStep) {
    console.error(
      "❌ Missing broker volume step:",
      symbolData
    );

    throw new Error(
      `Invalid volume step for ${symbolData.symbolName}`
    );
  }

  const rawProtocolVolume =
    numericLots * lotSize;

  const validVolume =
    snapVolumeToStep(
      rawProtocolVolume,
      volumeStep
    );

  if (validVolume <= 0) {
    throw new Error(
      "Calculated trading volume is invalid."
    );
  }

  const minVolume = Number(
    symbolData.minVolume
  );

  const maxVolume = Number(
    symbolData.maxVolume
  );

  if (
    Number.isFinite(minVolume) &&
    minVolume > 0 &&
    validVolume < minVolume
  ) {
    throw new Error(
      `Volume is below broker minimum for ${symbolData.symbolName}.`
    );
  }

  if (
    Number.isFinite(maxVolume) &&
    maxVolume > 0 &&
    validVolume > maxVolume
  ) {
    throw new Error(
      `Volume exceeds broker maximum for ${symbolData.symbolName}.`
    );
  }

  console.log("");
  console.log("====================================");
  console.log("📦 VOLUME CALCULATION");
  console.log("====================================");

  console.log({
    symbol: symbolData.symbolName,

    lots: numericLots,

    brokerLotSize: lotSize,

    rawProtocolVolume,

    volumeStep,

    validVolume,

    minVolume:
      Number.isFinite(minVolume)
        ? minVolume
        : null,

    maxVolume:
      Number.isFinite(maxVolume)
        ? maxVolume
        : null,
  });

  return Math.round(validVolume);
}

// ============================================================
// SYMBOL HELPERS
// ============================================================

function getSymbolById(symbolId) {
  if (
    symbolId === undefined ||
    symbolId === null
  ) {
    return null;
  }

  return (
    symbolsById.get(
      String(symbolId)
    ) || null
  );
}

function getSymbolByName(symbolName) {
  const normalized =
    normalizeSymbolName(symbolName);

  return (
    symbolsMap.get(normalized) ||
    null
  );
}

function storeSymbol(symbolData) {
  if (!symbolData) return;

  if (
    symbolData.symbolId === undefined ||
    symbolData.symbolId === null
  ) {
    return;
  }

  const symbolId =
    String(symbolData.symbolId);

  const symbolName =
    symbolData.symbolName;

  if (symbolName) {
    const normalized =
      normalizeSymbolName(symbolName);

    symbolsMap.set(
      normalized,
      symbolData
    );
  }

  symbolsById.set(
    symbolId,
    symbolData
  );
}

// ============================================================
// FULL SYMBOL DATA REQUEST
// ============================================================

function requestFullSymbolData(symbolData) {
  return new Promise(
    (resolve, reject) => {
      try {
        if (!symbolData) {
          reject(
            new Error(
              "Symbol data unavailable."
            )
          );

          return;
        }

        if (
          symbolData.fullDataLoaded &&
          symbolData.volumeStep &&
          symbolData.lotSize
        ) {
          resolve(symbolData);

          return;
        }

        ensureMessageSender();

        const symbolIdString =
          String(symbolData.symbolId);

        // If request is already running,
        // reuse the same Promise.

        if (
          symbolRequestWaiters.has(
            symbolIdString
          )
        ) {
          const existing =
            symbolRequestWaiters.get(
              symbolIdString
            );

          existing
            .then(resolve)
            .catch(reject);

          return;
        }

        const requestPromise =
          new Promise(
            (
              requestResolve,
              requestReject
            ) => {
              const timeout =
                setTimeout(() => {
                  symbolRequestWaiters.delete(
                    symbolIdString
                  );

                  requestReject(
                    new Error(
                      `Timed out loading symbol data for ${symbolData.symbolName}.`
                    )
                  );
                }, 10000);

              const request =
                SymbolByIdReq.create({
                  ctidTraderAccountId:
                    selectedTradingAccountId,

                  symbolId: [
                    symbolData.symbolId,
                  ],
                });

              const payload =
                SymbolByIdReq
                  .encode(request)
                  .finish();

              symbolRequestWaiters.set(
                symbolIdString,
                {
                  resolve: requestResolve,
                  reject: requestReject,
                  timeout,
                }
              );

              const clientMsgId =
                `edgeflo-symbol-${symbolIdString}-${Date.now()}`;

              sendCTraderMessage(
                PAYLOAD.SYMBOL_BY_ID_REQ,
                payload,
                clientMsgId
              );
            }
          );

        requestPromise
          .then(resolve)
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    }
  );
}

// ============================================================
// PROCESS FULL SYMBOL DATA
// ============================================================

function processFullSymbolData(fullSymbol) {
  if (!fullSymbol) {
    return null;
  }

  const symbolIdString =
    String(fullSymbol.symbolId);

  const existing =
    symbolsById.get(
      symbolIdString
    );

  // Full ProtoOASymbol does not necessarily
  // contain symbolName.
  //
  // We preserve the name from LightSymbol.

  const symbolName =
    existing?.symbolName ||
    `SYMBOL_${symbolIdString}`;

  const fullData = {
    symbolId:
      fullSymbol.symbolId,

    symbolName,

    minVolume:
      fullSymbol.minVolume !== undefined
        ? toNumberSafe(
            fullSymbol.minVolume
          )
        : null,

    maxVolume:
      fullSymbol.maxVolume !== undefined
        ? toNumberSafe(
            fullSymbol.maxVolume
          )
        : null,

    volumeStep:
      fullSymbol.stepVolume !== undefined
        ? toNumberSafe(
            fullSymbol.stepVolume
          )
        : null,

    lotSize:
      fullSymbol.lotSize !== undefined
        ? toNumberSafe(
            fullSymbol.lotSize
          )
        : null,

    digits:
      fullSymbol.digits !== undefined
        ? Number(
            fullSymbol.digits
          )
        : 5,

    pipPosition:
      fullSymbol.pipPosition !== undefined
        ? Number(
            fullSymbol.pipPosition
          )
        : null,

    tradingMode:
      fullSymbol.tradingMode !== undefined
        ? fullSymbol.tradingMode
        : null,

    measurementUnits:
      fullSymbol.measurementUnits ||
      null,

    fullDataLoaded: true,
  };

  storeSymbol(fullData);

  console.log("");
  console.log("====================================");
  console.log(
    `✅ FULL SYMBOL DATA: ${symbolName}`
  );
  console.log("====================================");

  console.log(fullData);

  return fullData;
}

// ============================================================
// SET SELECTED SYMBOL
// ============================================================

async function activateSymbol(
  symbolName
) {
  const normalized =
    normalizeSymbolName(symbolName);

  let symbolData =
    symbolsMap.get(normalized);

  if (!symbolData) {
    throw new Error(
      `Symbol ${symbolName} was not found in your cTrader account.`
    );
  }

  // Load full trading metadata if needed.

  if (
    !symbolData.fullDataLoaded ||
    !symbolData.volumeStep ||
    !symbolData.lotSize
  ) {
    console.log("");

    console.log(
      "===================================="
    );

    console.log(
      `📡 LOADING FULL SYMBOL DATA: ${symbolData.symbolName}`
    );

    console.log(
      "===================================="
    );

    symbolData =
      await requestFullSymbolData(
        symbolData
      );
  }

  if (!symbolData) {
    throw new Error(
      `Unable to load full data for ${symbolName}.`
    );
  }

  if (
    !symbolData.volumeStep ||
    !symbolData.lotSize
  ) {
    throw new Error(
      `Trading volume configuration is incomplete for ${symbolData.symbolName}.`
    );
  }

  selectedSymbolId =
    symbolData.symbolId;

  selectedSymbolName =
    symbolData.symbolName;

  selectedSymbolVolumeMin =
    symbolData.minVolume;

  selectedSymbolVolumeMax =
    symbolData.maxVolume;

  selectedSymbolVolumeStep =
    symbolData.volumeStep;

  selectedSymbolLotSize =
    symbolData.lotSize;

  selectedSymbolDigits =
    symbolData.digits ?? 5;

  console.log("");

  console.log(
    "===================================="
  );

  console.log(
    "🔄 SYMBOL ACTIVATED"
  );

  console.log(
    "===================================="
  );

  console.log({
    symbol:
      selectedSymbolName,

    symbolId:
      toStringSafe(
        selectedSymbolId
      ),

    digits:
      selectedSymbolDigits,

    minVolume:
      selectedSymbolVolumeMin,

    maxVolume:
      selectedSymbolVolumeMax,

    volumeStep:
      selectedSymbolVolumeStep,

    lotSize:
      selectedSymbolLotSize,
  });

  await subscribeToSymbol(
    symbolData
  );

  return symbolData;
}

// ============================================================
// RESET SERVICE
// ============================================================

function resetServiceState() {
  running = false;
  connected = false;
  authenticated = false;
  serviceReady = false;

  sendCTraderMessage = null;

  selectedTradingAccountId = null;

  selectedSymbolId = null;
  selectedSymbolName = null;

  selectedSymbolVolumeMin = null;
  selectedSymbolVolumeMax = null;
  selectedSymbolVolumeStep = null;
  selectedSymbolLotSize = null;

  selectedSymbolDigits = 5;

  subscribedSymbols.clear();

  latestPrices.clear();

  ws = null;

  onPriceUpdate = null;
  onExecutionUpdate = null;

  accountsMap.clear();

  symbolsMap.clear();
  symbolsById.clear();

  for (
    const waiter
    of symbolRequestWaiters.values()
  ) {
    if (waiter.timeout) {
      clearTimeout(waiter.timeout);
    }

    if (waiter.reject) {
      waiter.reject(
        new Error(
          "cTrader service reset."
        )
      );
    }
  }

  symbolRequestWaiters.clear();

  resetAccountInfo();
}

function rejectStartup(error) {
  if (startupReject) {
    startupReject(error);
  }

  startupResolve = null;
  startupReject = null;
}

function resolveStartup() {
  if (startupResolve) {
    startupResolve(
      getCTraderServiceStatus()
    );
  }

  startupResolve = null;
  startupReject = null;
}

// ============================================================
// STOP SERVICE
// ============================================================

export async function stopCTraderService() {
  const currentWs = ws;

  if (
    startupPromise &&
    !serviceReady
  ) {
    rejectStartup(
      new Error(
        "cTrader service stopped during startup."
      )
    );
  }

  startupPromise = null;

  if (currentWs) {
    try {
      currentWs.removeAllListeners();

      if (
        currentWs.readyState ===
          WebSocket.OPEN ||
        currentWs.readyState ===
          WebSocket.CONNECTING
      ) {
        currentWs.close(
          1000,
          "Service stopped"
        );
      }
    } catch (error) {
      console.error(
        "Error closing cTrader:",
        error.message
      );
    }
  }

  resetServiceState();

  console.log(
    "🛑 cTrader service stopped."
  );
}

// ============================================================
// LOAD PROTOBUF
// ============================================================

async function loadProtobuf() {
  console.log(
    "📦 Loading cTrader protobuf..."
  );

  if (!fs.existsSync(PROTO_DIR)) {
    throw new Error(
      `Proto directory not found: ${PROTO_DIR}`
    );
  }

  const protoFiles = fs
    .readdirSync(PROTO_DIR)
    .filter((file) =>
      file.endsWith(".proto")
    )
    .map((file) =>
      path.join(
        PROTO_DIR,
        file
      )
    );

  if (protoFiles.length === 0) {
    throw new Error(
      "No proto files found."
    );
  }

  const root =
    await protobuf.load(protoFiles);

  ProtoMessage =
    root.lookupType(
      "ProtoMessage"
    );

  // ==========================================================
  // AUTH
  // ==========================================================

  ApplicationAuthReq =
    root.lookupType(
      "ProtoOAApplicationAuthReq"
    );

  GetAccountsReq =
    root.lookupType(
      "ProtoOAGetAccountListByAccessTokenReq"
    );

  GetAccountsRes =
    root.lookupType(
      "ProtoOAGetAccountListByAccessTokenRes"
    );

  AccountAuthReq =
    root.lookupType(
      "ProtoOAAccountAuthReq"
    );

  AccountAuthRes =
    root.lookupType(
      "ProtoOAAccountAuthRes"
    );

  // ==========================================================
  // TRADER
  // ==========================================================

  TraderReq =
    root.lookupType(
      "ProtoOATraderReq"
    );

  TraderRes =
    root.lookupType(
      "ProtoOATraderRes"
    );

  // ==========================================================
  // SYMBOLS
  // ==========================================================

  SymbolsListReq =
    root.lookupType(
      "ProtoOASymbolsListReq"
    );

  SymbolsListRes =
    root.lookupType(
      "ProtoOASymbolsListRes"
    );

  SymbolByIdReq =
    root.lookupType(
      "ProtoOASymbolByIdReq"
    );

  SymbolByIdRes =
    root.lookupType(
      "ProtoOASymbolByIdRes"
    );

  // ==========================================================
  // PRICES
  // ==========================================================

  SubscribeSpotsReq =
    root.lookupType(
      "ProtoOASubscribeSpotsReq"
    );

  SpotEvent =
    root.lookupType(
      "ProtoOASpotEvent"
    );

  // ==========================================================
  // ORDERS
  // ==========================================================

  NewOrderReq =
    root.lookupType(
      "ProtoOANewOrderReq"
    );

  ClosePositionReq =
    root.lookupType(
      "ProtoOAClosePositionReq"
    );

  AmendPositionSLTPReq =
    root.lookupType(
      "ProtoOAAmendPositionSLTPReq"
    );

  ExecutionEvent =
    root.lookupType(
      "ProtoOAExecutionEvent"
    );

  OrderErrorEvent =
    root.lookupType(
      "ProtoOAOrderErrorEvent"
    );

  // ==========================================================
  // PAYLOAD ENUM
  // ==========================================================

  const PayloadType =
    root.lookupEnum(
      "ProtoOAPayloadType"
    ).values;

  PAYLOAD = {

    APP_AUTH_REQ:
      PayloadType
        .PROTO_OA_APPLICATION_AUTH_REQ,

    APP_AUTH_RES:
      PayloadType
        .PROTO_OA_APPLICATION_AUTH_RES,

    ACCOUNT_AUTH_REQ:
      PayloadType
        .PROTO_OA_ACCOUNT_AUTH_REQ,

    ACCOUNT_AUTH_RES:
      PayloadType
        .PROTO_OA_ACCOUNT_AUTH_RES,

    GET_ACCOUNTS_REQ:
      PayloadType
        .PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ,

    GET_ACCOUNTS_RES:
      PayloadType
        .PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_RES,

    TRADER_REQ:
      PayloadType
        .PROTO_OA_TRADER_REQ,

    TRADER_RES:
      PayloadType
        .PROTO_OA_TRADER_RES,

    SYMBOLS_LIST_REQ:
      PayloadType
        .PROTO_OA_SYMBOLS_LIST_REQ,

    SYMBOLS_LIST_RES:
      PayloadType
        .PROTO_OA_SYMBOLS_LIST_RES,

    SYMBOL_BY_ID_REQ:
      PayloadType
        .PROTO_OA_SYMBOL_BY_ID_REQ,

    SYMBOL_BY_ID_RES:
      PayloadType
        .PROTO_OA_SYMBOL_BY_ID_RES,

    SUBSCRIBE_SPOTS_REQ:
      PayloadType
        .PROTO_OA_SUBSCRIBE_SPOTS_REQ,

    SUBSCRIBE_SPOTS_RES:
      PayloadType
        .PROTO_OA_SUBSCRIBE_SPOTS_RES,

    SPOT_EVENT:
      PayloadType
        .PROTO_OA_SPOT_EVENT,

    NEW_ORDER_REQ:
      PayloadType
        .PROTO_OA_NEW_ORDER_REQ,

    CLOSE_POSITION_REQ:
      PayloadType
        .PROTO_OA_CLOSE_POSITION_REQ,

    AMEND_POSITION_SLTP_REQ:
      PayloadType
        .PROTO_OA_AMEND_POSITION_SLTP_REQ,

    EXECUTION_EVENT:
      PayloadType
        .PROTO_OA_EXECUTION_EVENT,

    ORDER_ERROR_EVENT:
      PayloadType
        .PROTO_OA_ORDER_ERROR_EVENT,
  };

  ORDER_TYPE =
    root.lookupEnum(
      "ProtoOAOrderType"
    ).values;

  TRADE_SIDE =
    root.lookupEnum(
      "ProtoOATradeSide"
    ).values;

  console.log(
    "✅ cTrader protobuf loaded."
  );
}

// ============================================================
// SEND SAFETY CHECK
// ============================================================

function ensureMessageSender() {
  if (
    !sendCTraderMessage ||
    !ws ||
    ws.readyState !== WebSocket.OPEN
  ) {
    throw new Error(
      "cTrader connection is unavailable."
    );
  }
}

// ============================================================
// SUBSCRIBE TO SYMBOL
// ============================================================

async function subscribeToSymbol(
  symbolData
) {
  if (!symbolData) {
    throw new Error(
      "Symbol data unavailable."
    );
  }

  ensureMessageSender();

  const symbolIdString =
    String(symbolData.symbolId);

  if (
    subscribedSymbols.has(
      symbolIdString
    )
  ) {
    console.log(
      `📡 Already subscribed: ${symbolData.symbolName}`
    );

    return;
  }

  const request =
    SubscribeSpotsReq.create({
      ctidTraderAccountId:
        selectedTradingAccountId,

      symbolId: [
        symbolData.symbolId,
      ],

      subscribeToSpotTimestamp:
        true,
    });

  const payload =
    SubscribeSpotsReq
      .encode(request)
      .finish();

  const clientMsgId =
    `edgeflo-subscribe-${symbolIdString}-${Date.now()}`;

  sendCTraderMessage(
    PAYLOAD.SUBSCRIBE_SPOTS_REQ,
    payload,
    clientMsgId
  );

  subscribedSymbols.add(
    symbolIdString
  );

  console.log(
    `📡 SUBSCRIBED: ${symbolData.symbolName}`
  );
}

// ============================================================
// SELECT TRADING SYMBOL
// ============================================================

export async function selectTradingSymbol(
  symbolName
) {
  if (!authenticated) {
    throw new Error(
      "cTrader account is not authenticated."
    );
  }

  if (!serviceReady) {
    throw new Error(
      "cTrader service is not ready."
    );
  }

  const symbolData =
    await activateSymbol(
      symbolName
    );

  return {
    success: true,

    symbol:
      selectedSymbolName,

    symbolId:
      toStringSafe(
        selectedSymbolId
      ),

    digits:
      selectedSymbolDigits,

    volumeSettings: {
      min:
        selectedSymbolVolumeMin,

      max:
        selectedSymbolVolumeMax,

      step:
        selectedSymbolVolumeStep,

      lotSize:
        selectedSymbolLotSize,
    },

    message:
      `${symbolData.symbolName} selected successfully.`,
  };
}

// ============================================================
// START CTRADER SERVICE
// ============================================================

export async function startCTraderService(
  priceCallback,
  executionCallback,
  accessToken,
  preferredAccountId = null
) {
  if (
    !accessToken ||
    typeof accessToken !== "string"
  ) {
    throw new Error(
      "Valid cTrader access token is required."
    );
  }

  // Already ready

  if (
    running &&
    connected &&
    authenticated &&
    serviceReady
  ) {
    return getCTraderServiceStatus();
  }

  // Startup already running

  if (startupPromise) {
    return startupPromise;
  }

  startupPromise =
    new Promise(
      (resolve, reject) => {
        startupResolve = resolve;
        startupReject = reject;

        (async () => {
          try {
            resetServiceState();

            onPriceUpdate =
              typeof priceCallback ===
              "function"
                ? priceCallback
                : null;

            onExecutionUpdate =
              typeof executionCallback ===
              "function"
                ? executionCallback
                : null;

            running = true;

            await loadProtobuf();

            const clientId =
              process.env
                .CTRADER_CLIENT_ID;

            const clientSecret =
              process.env
                .CTRADER_CLIENT_SECRET;

            if (!clientId) {
              throw new Error(
                "CTRADER_CLIENT_ID missing."
              );
            }

            if (!clientSecret) {
              throw new Error(
                "CTRADER_CLIENT_SECRET missing."
              );
            }

            console.log(
              "🔌 Connecting to cTrader..."
            );

            ws = new WebSocket(
              WS_URL
            );

            // ==================================================
            // SEND MESSAGE
            // ==================================================

            function sendMessage(
              payloadType,
              payload,
              clientMsgId
            ) {
              if (
                !ws ||
                ws.readyState !==
                  WebSocket.OPEN
              ) {
                throw new Error(
                  "cTrader WebSocket is not open."
                );
              }

              const message =
                ProtoMessage.create({
                  payloadType,
                  payload,
                  clientMsgId,
                });

              const buffer =
                ProtoMessage
                  .encode(message)
                  .finish();

              ws.send(buffer);
            }

            sendCTraderMessage =
              sendMessage;

            // ==================================================
            // CONNECTION OPEN
            // ==================================================

            ws.on(
              "open",
              () => {
                try {
                  connected = true;

                  console.log(
                    "✅ cTRADER WEBSOCKET CONNECTED"
                  );

                  const request =
                    ApplicationAuthReq.create({
                      clientId,
                      clientSecret,
                    });

                  const payload =
                    ApplicationAuthReq
                      .encode(request)
                      .finish();

                  sendMessage(
                    PAYLOAD.APP_AUTH_REQ,
                    payload,
                    "edgeflo-app-auth"
                  );
                } catch (error) {
                  console.error(
                    "❌ Application auth error:",
                    error.message
                  );

                  rejectStartup(error);
                }
              }
            );

            // ==================================================
            // MESSAGE HANDLER
            // ==================================================

            ws.on(
              "message",
              async (data) => {
                try {
                  const outer =
                    ProtoMessage.decode(
                      new Uint8Array(data)
                    );

                  const payloadType =
                    Number(
                      outer.payloadType
                    );

                  // ==============================================
                  // APPLICATION AUTH
                  // ==============================================

                  if (
                    payloadType ===
                    PAYLOAD.APP_AUTH_RES
                  ) {
                    console.log(
                      "✅ Application authenticated"
                    );

                    const request =
                      GetAccountsReq.create({
                        accessToken,
                      });

                    const payload =
                      GetAccountsReq
                        .encode(request)
                        .finish();

                    sendMessage(
                      PAYLOAD.GET_ACCOUNTS_REQ,
                      payload,
                      "edgeflo-get-accounts"
                    );

                    return;
                  }

                  // ==============================================
                  // GET ACCOUNTS
                  // ==============================================

                  if (
                    payloadType ===
                    PAYLOAD.GET_ACCOUNTS_RES
                  ) {
                    const response =
                      GetAccountsRes.decode(
                        outer.payload
                      );

                    const accounts =
                      response.ctidTraderAccount ||
                      [];

                    if (
                      accounts.length === 0
                    ) {
                      throw new Error(
                        "No authorized cTrader accounts found."
                      );
                    }

                    accountsMap.clear();

                    accounts.forEach(
                      (account) => {
                        const accountData =
                          buildAccountFromAuthorizedAccount(
                            account
                          );

                        if (
                          accountData.accountId
                        ) {
                          accountsMap.set(
                            accountData.accountId,
                            accountData
                          );
                        }
                      }
                    );

                    console.log(
                      `✅ Found ${accounts.length} cTrader account(s)`
                    );

                    let account =
                      accounts[0];

                    if (
                      preferredAccountId
                    ) {
                      const found =
                        accounts.find(
                          (item) =>
                            String(
                              item.ctidTraderAccountId
                            ) ===
                            String(
                              preferredAccountId
                            )
                        );

                      if (found) {
                        account = found;
                      } else {
                        console.warn(
                          "⚠️ Preferred account not found. Using first account."
                        );
                      }
                    }

                    selectedTradingAccountId =
                      account.ctidTraderAccountId;

                    console.log(
                      "🏦 Selected account:",
                      toStringSafe(
                        selectedTradingAccountId
                      )
                    );

                    const request =
                      AccountAuthReq.create({
                        ctidTraderAccountId:
                          selectedTradingAccountId,

                        accessToken,
                      });

                    const payload =
                      AccountAuthReq
                        .encode(request)
                        .finish();

                    sendMessage(
                      PAYLOAD.ACCOUNT_AUTH_REQ,
                      payload,
                      "edgeflo-account-auth"
                    );

                    return;
                  }

                  // ==============================================
                  // ACCOUNT AUTH
                  // ==============================================

                  if (
                    payloadType ===
                    PAYLOAD.ACCOUNT_AUTH_RES
                  ) {
                    const response =
                      AccountAuthRes.decode(
                        outer.payload
                      );

                    selectedTradingAccountId =
                      response.ctidTraderAccountId;

                    authenticated = true;

                    console.log(
                      "✅ cTrader account authenticated"
                    );

                    const request =
                      TraderReq.create({
                        ctidTraderAccountId:
                          selectedTradingAccountId,
                      });

                    const payload =
                      TraderReq
                        .encode(request)
                        .finish();

                    sendMessage(
                      PAYLOAD.TRADER_REQ,
                      payload,
                      "edgeflo-trader"
                    );

                    return;
                  }

                  // ==============================================
                  // TRADER
                  // ==============================================

                  if (
                    payloadType ===
                    PAYLOAD.TRADER_RES
                  ) {
                    const response =
                      TraderRes.decode(
                        outer.payload
                      );

                    // IMPORTANT:
                    // ProtoOATraderRes contains
                    // response.trader

                    const trader =
                      response.trader ||
                      response;

                    updateAccountInfoFromTrader(
                      trader
                    );

                    const request =
                      SymbolsListReq.create({
                        ctidTraderAccountId:
                          selectedTradingAccountId,

                        includeArchivedSymbols:
                          false,
                      });

                    const payload =
                      SymbolsListReq
                        .encode(request)
                        .finish();

                    sendMessage(
                      PAYLOAD.SYMBOLS_LIST_REQ,
                      payload,
                      "edgeflo-symbols"
                    );

                    return;
                  }

                  // ==============================================
                  // SYMBOL LIST
                  // ==============================================

                  if (
                    payloadType ===
                    PAYLOAD.SYMBOLS_LIST_RES
                  ) {
                    const response =
                      SymbolsListRes.decode(
                        outer.payload
                      );

                    const symbols =
                      response.symbol || [];

                    symbolsMap.clear();
                    symbolsById.clear();

                    symbols.forEach(
                      (symbol) => {
                        const normalizedName =
                          normalizeSymbolName(
                            symbol.symbolName
                          );

                        if (
                          !normalizedName ||
                          symbol.symbolId ===
                            undefined ||
                          symbol.symbolId ===
                            null
                        ) {
                          return;
                        }

                        // LightSymbol does NOT contain
                        // full trading volume settings.

                        const lightSymbol = {
                          symbolId:
                            symbol.symbolId,

                          symbolName:
                            symbol.symbolName,

                          minVolume:
                            null,

                          maxVolume:
                            null,

                          volumeStep:
                            null,

                          lotSize:
                            null,

                          digits:
                            null,

                          fullDataLoaded:
                            false,
                        };

                        storeSymbol(
                          lightSymbol
                        );
                      }
                    );

                    console.log(
                      `✅ Stored ${symbolsMap.size} light symbols`
                    );

                    const eurusd =
                      symbolsMap.get(
                        "EURUSD"
                      );

                    if (!eurusd) {
                      throw new Error(
                        "EURUSD was not found in your cTrader account."
                      );
                    }

                    // Load FULL EURUSD data first.

                    console.log("");

                    console.log(
                      "===================================="
                    );

                    console.log(
                      "📡 REQUESTING FULL EURUSD DATA"
                    );

                    console.log(
                      "===================================="
                    );

                    await activateSymbol(
                      "EURUSD"
                    );

                    serviceReady = true;

                    console.log("");

                    console.log(
                      "===================================="
                    );

                    console.log(
                      "🚀 cTRADER SERVICE FULLY READY"
                    );

                    console.log(
                      "===================================="
                    );

                    resolveStartup();

                    return;
                  }

                  // ==============================================
                  // FULL SYMBOL DATA
                  // ==============================================

                  if (
                    payloadType ===
                    PAYLOAD.SYMBOL_BY_ID_RES
                  ) {
                    const response =
                      SymbolByIdRes.decode(
                        outer.payload
                      );

                    const fullSymbols =
                      response.symbol || [];

                    fullSymbols.forEach(
                      (fullSymbol) => {
                        const processed =
                          processFullSymbolData(
                            fullSymbol
                          );

                        if (!processed) {
                          return;
                        }

                        const symbolIdString =
                          String(
                            processed.symbolId
                          );

                        const waiter =
                          symbolRequestWaiters.get(
                            symbolIdString
                          );

                        if (waiter) {
                          if (
                            waiter.timeout
                          ) {
                            clearTimeout(
                              waiter.timeout
                            );
                          }

                          symbolRequestWaiters.delete(
                            symbolIdString
                          );

                          waiter.resolve(
                            processed
                          );
                        }
                      }
                    );

                    return;
                  }

                  // ==============================================
                  // SUBSCRIBE RESPONSE
                  // ==============================================

                  if (
                    payloadType ===
                    PAYLOAD.SUBSCRIBE_SPOTS_RES
                  ) {
                    console.log(
                      "✅ Spot subscription confirmed"
                    );

                    return;
                  }

                  // ==============================================
                  // LIVE PRICE
                  // ==============================================

                  if (
                    payloadType ===
                    PAYLOAD.SPOT_EVENT
                  ) {
                    const spot =
                      SpotEvent.decode(
                        outer.payload
                      );

                    const symbolData =
                      getSymbolById(
                        spot.symbolId
                      );

                    if (!symbolData) {
                      return;
                    }

                    // SpotEvent prices are normally
                    // represented with symbol precision.
                    //
                    // Use symbol digits when available.

                    const digits =
                      Number.isFinite(
                        Number(
                          symbolData.digits
                        )
                      )
                        ? Number(
                            symbolData.digits
                          )
                        : 5;

                    const priceScale =
                      getPriceScale(
                        digits
                      );

                    const symbolKey =
                      normalizeSymbolName(
                        symbolData.symbolName
                      );

                    const previousPrice =
                      latestPrices.get(
                        symbolKey
                      ) || {};

                    let bid =
                      previousPrice.bid ??
                      null;

                    let ask =
                      previousPrice.ask ??
                      null;

                    if (
                      spot.bid !== undefined &&
                      spot.bid !== null
                    ) {
                      const rawBid =
                        toNumberSafe(
                          spot.bid
                        );

                      if (
                        rawBid !== null &&
                        rawBid > 0
                      ) {
                        bid =
                          rawBid /
                          priceScale;
                      }
                    }

                    if (
                      spot.ask !== undefined &&
                      spot.ask !== null
                    ) {
                      const rawAsk =
                        toNumberSafe(
                          spot.ask
                        );

                      if (
                        rawAsk !== null &&
                        rawAsk > 0
                      ) {
                        ask =
                          rawAsk /
                          priceScale;
                      }
                    }

                    const priceData = {
                      type: "price",

                      symbol:
                        symbolData.symbolName,

                      symbolId:
                        toStringSafe(
                          spot.symbolId
                        ),

                      bid,

                      ask,

                      digits,

                      timestamp:
                        spot.timestamp !==
                          undefined &&
                        spot.timestamp !==
                          null
                          ? toNumberSafe(
                              spot.timestamp
                            )
                          : Date.now(),
                    };

                    latestPrices.set(
                      symbolKey,
                      priceData
                    );

                    if (
                      typeof onPriceUpdate ===
                      "function"
                    ) {
                      onPriceUpdate(
                        priceData
                      );
                    }

                    return;
                  }

                  // ==============================================
                  // EXECUTION EVENT
                  // ==============================================

                  if (
                    payloadType ===
                    PAYLOAD.EXECUTION_EVENT
                  ) {
                    const execution =
                      ExecutionEvent.decode(
                        outer.payload
                      );

                    console.log("");

                    console.log(
                      "===================================="
                    );

                    console.log(
                      "📈 EXECUTION EVENT"
                    );

                    console.log(
                      "===================================="
                    );

                    console.log(
                      execution
                    );

                    if (
                      typeof onExecutionUpdate ===
                      "function"
                    ) {
                      onExecutionUpdate({
                        type:
                          "execution",

                        data:
                          execution,

                        timestamp:
                          Date.now(),
                      });
                    }

                    return;
                  }

                  // ==============================================
                  // ORDER ERROR
                  // ==============================================

                  if (
                    payloadType ===
                    PAYLOAD.ORDER_ERROR_EVENT
                  ) {
                    const errorEvent =
                      OrderErrorEvent.decode(
                        outer.payload
                      );

                    console.error("");

                    console.error(
                      "===================================="
                    );

                    console.error(
                      "❌ cTrader Order Error"
                    );

                    console.error(
                      "===================================="
                    );

                    console.error(
                      errorEvent
                    );

                    if (
                      typeof onExecutionUpdate ===
                      "function"
                    ) {
                      onExecutionUpdate({
                        type:
                          "order_error",

                        message:
                          errorEvent.description ||
                          errorEvent.errorDescription ||
                          errorEvent.errorCode ||
                          "cTrader order error.",

                        data:
                          errorEvent,

                        timestamp:
                          Date.now(),
                      });
                    }

                    return;
                  }
                } catch (error) {
                  console.error(
                    "❌ cTrader message error:",
                    error.message
                  );

                  if (!serviceReady) {
                    rejectStartup(error);
                  }
                }
              }
            );

            // ==================================================
            // ERROR
            // ==================================================

            ws.on(
              "error",
              (error) => {
                console.error(
                  "❌ cTrader WebSocket error:",
                  error.message
                );

                if (!serviceReady) {
                  rejectStartup(
                    error
                  );
                }
              }
            );

            // ==================================================
            // CLOSE
            // ==================================================

            ws.on(
              "close",
              (code, reason) => {
                console.log(
                  "🔌 cTrader connection closed"
                );

                console.log(
                  "Code:",
                  code
                );

                console.log(
                  "Reason:",
                  reason?.toString()
                );

                const wasReady =
                  serviceReady;

                if (!wasReady) {
                  rejectStartup(
                    new Error(
                      `cTrader closed during startup. Code: ${code}`
                    )
                  );
                }

                resetServiceState();

                startupPromise = null;
              }
            );
          } catch (error) {
            console.error(
              "❌ cTrader startup failed:",
              error.message
            );

            resetServiceState();

            rejectStartup(error);

            startupPromise = null;
          }
        })();
      }
    );

  try {
    return await startupPromise;
  } finally {
    if (serviceReady) {
      startupPromise = null;
    }
  }
}

// ============================================================
// PLACE MARKET ORDER
// ============================================================

export async function placeMarketOrder({
  side,
  lots,
  stopLoss = null,
  takeProfit = null,
  label = null,
  comment = null,
}) {
  if (!authenticated) {
    throw new Error(
      "cTrader account is not authenticated."
    );
  }

  if (!serviceReady) {
    throw new Error(
      "cTrader service is not ready."
    );
  }

  if (!selectedSymbolId) {
    throw new Error(
      "Trading symbol is unavailable."
    );
  }

  ensureMessageSender();

  const normalizedSide =
    String(side || "")
      .trim()
      .toUpperCase();

  let tradeSide;

  if (
    normalizedSide === "BUY"
  ) {
    tradeSide =
      TRADE_SIDE.BUY;
  } else if (
    normalizedSide === "SELL"
  ) {
    tradeSide =
      TRADE_SIDE.SELL;
  } else {
    throw new Error(
      "Order side must be BUY or SELL."
    );
  }

  const symbolData =
    getSymbolById(
      selectedSymbolId
    );

  if (!symbolData) {
    throw new Error(
      "Selected symbol data unavailable."
    );
  }

  // Extra safety:
  // Always ensure full metadata exists.

  if (
    !symbolData.fullDataLoaded ||
    !symbolData.volumeStep ||
    !symbolData.lotSize
  ) {
    throw new Error(
      `Full trading configuration is unavailable for ${symbolData.symbolName}.`
    );
  }

  const volume =
    lotsToVolume(
      lots,
      symbolData
    );

  const normalizedStopLoss =
    normalizePrice(stopLoss);

  const normalizedTakeProfit =
    normalizePrice(takeProfit);

  const clientOrderId =
    `edgeflo-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  const requestData = {
    ctidTraderAccountId:
      selectedTradingAccountId,

    symbolId:
      selectedSymbolId,

    orderType:
      ORDER_TYPE.MARKET,

    tradeSide,

    volume,

    clientOrderId,
  };

  // Stop Loss

  if (
    normalizedStopLoss !== null
  ) {
    requestData.stopLoss =
      normalizedStopLoss;
  }

  // Take Profit

  if (
    normalizedTakeProfit !== null
  ) {
    requestData.takeProfit =
      normalizedTakeProfit;
  }

  if (label) {
    requestData.label =
      String(label).slice(
        0,
        100
      );
  }

  if (comment) {
    requestData.comment =
      String(comment).slice(
        0,
        512
      );
  }

  const request =
    NewOrderReq.create(
      requestData
    );

  const payload =
    NewOrderReq
      .encode(request)
      .finish();

  sendCTraderMessage(
    PAYLOAD.NEW_ORDER_REQ,
    payload,
    clientOrderId
  );

  console.log("");

  console.log(
    "===================================="
  );

  console.log(
    "📤 MARKET ORDER SENT"
  );

  console.log(
    "===================================="
  );

  console.log({
    account:
      toStringSafe(
        selectedTradingAccountId
      ),

    symbol:
      selectedSymbolName,

    side:
      normalizedSide,

    lots:
      Number(lots),

    volume,

    lotSize:
      symbolData.lotSize,

    volumeStep:
      symbolData.volumeStep,

    minVolume:
      symbolData.minVolume,

    maxVolume:
      symbolData.maxVolume,

    stopLoss:
      normalizedStopLoss,

    takeProfit:
      normalizedTakeProfit,
  });

  return {
    success: true,

    symbol:
      selectedSymbolName,

    symbolId:
      toStringSafe(
        selectedSymbolId
      ),

    side:
      normalizedSide,

    lots:
      Number(lots),

    volume,

    clientOrderId,

    requestedStopLoss:
      normalizedStopLoss,

    requestedTakeProfit:
      normalizedTakeProfit,
  };
}

// ============================================================
// CLOSE POSITION
// ============================================================

export async function closePosition({
  positionId,
  lots,
}) {
  if (!authenticated) {
    throw new Error(
      "cTrader account is not authenticated."
    );
  }

  if (!serviceReady) {
    throw new Error(
      "cTrader service is not ready."
    );
  }

  if (!positionId) {
    throw new Error(
      "Position ID is required."
    );
  }

  ensureMessageSender();

  const symbolData =
    getSymbolById(
      selectedSymbolId
    );

  if (!symbolData) {
    throw new Error(
      "Selected symbol data unavailable."
    );
  }

  const volume =
    lotsToVolume(
      lots,
      symbolData
    );

  const request =
    ClosePositionReq.create({
      ctidTraderAccountId:
        selectedTradingAccountId,

      positionId,

      volume,
    });

  const payload =
    ClosePositionReq
      .encode(request)
      .finish();

  const clientMsgId =
    `edgeflo-close-${Date.now()}`;

  sendCTraderMessage(
    PAYLOAD.CLOSE_POSITION_REQ,
    payload,
    clientMsgId
  );

  console.log(
    "📤 CLOSE POSITION SENT:",
    {
      positionId,
      lots,
      volume,
    }
  );

  return {
    success: true,

    positionId:
      String(positionId),

    volume,

    clientMsgId,
  };
}

// ============================================================
// AMEND POSITION SL / TP
// ============================================================

export async function amendPositionSLTP({
  positionId,
  stopLoss = null,
  takeProfit = null,
}) {
  if (!authenticated) {
    throw new Error(
      "cTrader account is not authenticated."
    );
  }

  if (!serviceReady) {
    throw new Error(
      "cTrader service is not ready."
    );
  }

  if (!positionId) {
    throw new Error(
      "Position ID is required."
    );
  }

  ensureMessageSender();

  const normalizedSL =
    normalizePrice(stopLoss);

  const normalizedTP =
    normalizePrice(takeProfit);

  if (
    normalizedSL === null &&
    normalizedTP === null
  ) {
    throw new Error(
      "Provide stopLoss or takeProfit."
    );
  }

  const requestData = {
    ctidTraderAccountId:
      selectedTradingAccountId,

    positionId,
  };

  if (
    normalizedSL !== null
  ) {
    requestData.stopLoss =
      normalizedSL;
  }

  if (
    normalizedTP !== null
  ) {
    requestData.takeProfit =
      normalizedTP;
  }

  const request =
    AmendPositionSLTPReq.create(
      requestData
    );

  const payload =
    AmendPositionSLTPReq
      .encode(request)
      .finish();

  const clientMsgId =
    `edgeflo-sltp-${Date.now()}`;

  sendCTraderMessage(
    PAYLOAD.AMEND_POSITION_SLTP_REQ,
    payload,
    clientMsgId
  );

  console.log(
    "✏️ POSITION SL/TP AMEND SENT:",
    {
      positionId,

      stopLoss:
        normalizedSL,

      takeProfit:
        normalizedTP,
    }
  );

  return {
    success: true,

    positionId:
      String(positionId),

    stopLoss:
      normalizedSL,

    takeProfit:
      normalizedTP,

    clientMsgId,
  };
}

// ============================================================
// GET LATEST PRICE
// ============================================================

export function getLatestPrice(
  symbolName
) {
  const normalizedSymbol =
    normalizeSymbolName(
      symbolName
    );

  return (
    latestPrices.get(
      normalizedSymbol
    ) || null
  );
}

// ============================================================
// GET AVAILABLE ACCOUNTS
// ============================================================

export function getAvailableAccounts() {
  return Array.from(
    accountsMap.values()
  );
}

// ============================================================
// GET ACCOUNT INFORMATION
// ============================================================

export function getAccountInfo() {
  return {
    ...accountInfo,

    selectedAccountId:
      toStringSafe(
        selectedTradingAccountId
      ),
  };
}

// ============================================================
// GET AVAILABLE SYMBOLS
// ============================================================

export function getAvailableSymbols() {
  return Array.from(
    symbolsMap.values()
  ).map(
    (symbol) => ({
      symbolId:
        toStringSafe(
          symbol.symbolId
        ),

      symbolName:
        symbol.symbolName,

      minVolume:
        symbol.minVolume,

      maxVolume:
        symbol.maxVolume,

      volumeStep:
        symbol.volumeStep,

      lotSize:
        symbol.lotSize,

      digits:
        symbol.digits,

      fullDataLoaded:
        symbol.fullDataLoaded,
    })
  );
}

// ============================================================
// GET SERVICE STATUS
// ============================================================

export function getCTraderServiceStatus() {
  return {
    running,

    connected,

    authenticated,

    ready:
      serviceReady,

    tradingAccountId:
      toStringSafe(
        selectedTradingAccountId
      ),

    account:
      getAccountInfo(),

    symbol:
      selectedSymbolName,

    symbolId:
      toStringSafe(
        selectedSymbolId
      ),

    digits:
      selectedSymbolDigits,

    availableSymbols:
      symbolsMap.size,

    subscribedSymbols:
      Array.from(
        subscribedSymbols
      ),

    volumeSettings: {
      min:
        selectedSymbolVolumeMin,

      max:
        selectedSymbolVolumeMax,

      step:
        selectedSymbolVolumeStep,

      lotSize:
        selectedSymbolLotSize,
    },
  };
}