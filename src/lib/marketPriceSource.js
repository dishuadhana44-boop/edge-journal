// ============================================================
// MARKET PRICE SOURCE AUTHORITY
// ============================================================
//
// MarketContext.jsx keeps one `bid`/`ask` pair and has two producers that both
// write it: the MT5 poll (MarketContext.jsx:1374-1461) and the cTrader
// WebSocket `price` frames (:1198-1206). Neither knows about the other, so a
// selected cTrader account gets its ticket price rewritten by the MT5 demo
// bridge every second.
//
// This module answers the one question that resolves it: given the price
// source the app has been told is authoritative, may this feed write the price,
// and may this feed be requested at all.
//
// The declaration comes from outside. This module does not read storage, does
// not know what an account is, and cannot verify that the declared source
// matches the account the backend is actually trading on. Unknown is its own
// answer, and it deliberately means "change nothing" so that a user who has not
// selected an account keeps today's behaviour.

export const PRICE_SOURCE_MT5 = "mt5";
export const PRICE_SOURCE_CTRADER = "ctrader";

function lowercaseText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim().toLowerCase();

  return text === "" ? null : text;
}

export function normalizePriceSource(value) {
  const text = lowercaseText(value);

  if (text === PRICE_SOURCE_MT5) {
    return PRICE_SOURCE_MT5;
  }

  if (text === PRICE_SOURCE_CTRADER) {
    return PRICE_SOURCE_CTRADER;
  }

  return null;
}

export function priceSourceForBrokerKey(brokerKey) {
  return normalizePriceSource(brokerKey);
}

export function canApplyPrice(declaredSource, incomingSource) {
  const declared = normalizePriceSource(declaredSource);

  if (declared === null) {
    return true;
  }

  return normalizePriceSource(incomingSource) === declared;
}

export function shouldPollMt5Price(declaredSource) {
  return normalizePriceSource(declaredSource) !== PRICE_SOURCE_CTRADER;
}
