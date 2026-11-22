// src/services/backtest/simulationEngine.js
// Backtest SimulationEngine — pure and deterministic.
//
// It never touches TradeContext, MT5, cTrader or any live order endpoint:
// every entity it produces carries mode: "BACKTEST".
//
// The engine replays an *action journal* (what the trader clicked, and at which
// candle) over candles 1..visibleCount. Because state is always rebuilt from
// scratch up to the replay cursor, dragging the timeline backwards can never
// expose a fill that depended on a candle the trader has not seen yet.

import {
  getSymbolSpec,
  positionPnl,
  requiredMargin,
  roundToLotStep,
  LOT_STEP,
  MIN_LOT,
  MAX_LOT,
} from "./symbolSpecs";

export const BACKTEST_MODE = "BACKTEST";

export const EXIT_REASONS = {
  TAKE_PROFIT: "Take Profit",
  STOP_LOSS: "Stop Loss",
  MANUAL: "Manual",
  END_OF_TEST: "End of Test",
  MARGIN_CALL: "Margin Call",
};

export const SAME_CANDLE_RULES = {
  SL_FIRST: "sl-first",
  TP_FIRST: "tp-first",
  NEAREST_TO_OPEN: "nearest-to-open",
};

export const DEFAULT_BACKTEST_SETTINGS = {
  initialBalance: 100000,
  accountCurrency: "USD",
  leverage: 100,
  spreadPips: 1.0,
  slippagePips: 0.0,
  commissionPerLot: 0.0,
  swapPerLotPerNight: 0.0,
  riskMode: "percent",
  riskPercent: 1.0,
  fixedLots: 0.1,
  sameCandleRule: SAME_CANDLE_RULES.SL_FIRST,
  stopOutLevelPct: 50,
  allowLong: true,
  allowShort: true,
};

const NIGHT_MS = 86400000;

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function normalizedVolume(volume) {
  const raw = Number(volume);
  // A negative size is a mistake, not a direction: never silently take |volume|.
  if (!Number.isFinite(raw) || raw < 0) return null;

  const stepped = roundToLotStep(raw);
  if (!Number.isFinite(stepped) || stepped < MIN_LOT || stepped > MAX_LOT) return null;
  return Number(stepped.toFixed(2));
}

// Candle prices are treated as mid. Half the spread is charged on each leg, so
// a round turn costs exactly the configured spread. Slippage is always adverse.
function sideOffset({ spec, spreadPips, slippagePips, side }) {
  const halfSpread = (Math.max(0, Number(spreadPips) || 0) / 2) * spec.pipSize;
  const slip = Math.max(0, Number(slippagePips) || 0) * spec.pipSize;
  return side === "BUY" ? halfSpread + slip : -(halfSpread + slip);
}

function pendingFillPrice(order, candle, spec, settings) {
  const offset = sideOffset({
    spec,
    spreadPips: settings.spreadPips,
    slippagePips: settings.slippagePips,
    side: order.side,
  });

  const isBuy = order.side === "BUY";

  if (order.orderType === "LIMIT") {
    const reached = isBuy ? candle.low <= order.price : candle.high >= order.price;
    if (!reached) return null;
    // A gap straight through the level fills at the better open price.
    return (isBuy ? Math.min(order.price, candle.open) : Math.max(order.price, candle.open)) + offset;
  }

  const reached = isBuy ? candle.high >= order.price : candle.low <= order.price;
  if (!reached) return null;
  return (isBuy ? Math.max(order.price, candle.open) : Math.min(order.price, candle.open)) + offset;
}

function levelTouched(level, candle, side, isStop) {
  if (level == null || !Number.isFinite(level)) return false;
  if (side === "BUY") return isStop ? candle.low <= level : candle.high >= level;
  return isStop ? candle.high >= level : candle.low <= level;
}

// Stops belong behind the market and targets ahead of it. An inverted level is
// always a mistake, so the engine refuses it instead of trading nonsense risk.
export function validateLevels({ side, referencePrice, sl, tp, digits = 5 }) {
  const isBuy = side === "BUY";
  const show = (value) => Number(value).toFixed(digits);

  if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
    return "There is no replayed price to measure stop and target against yet.";
  }

  if (sl != null && (!Number.isFinite(sl) || sl <= 0)) {
    return "Stop loss must be a price above 0, or left empty.";
  }

  if (tp != null && (!Number.isFinite(tp) || tp <= 0)) {
    return "Take profit must be a price above 0, or left empty.";
  }

  if (sl != null) {
    if (isBuy ? sl >= referencePrice : sl <= referencePrice) {
      return `Stop loss ${show(sl)} is on the wrong side of the ${isBuy ? "buy" : "sell"} price ${show(referencePrice)}.`;
    }
  }

  if (tp != null) {
    if (isBuy ? tp <= referencePrice : tp >= referencePrice) {
      return `Take profit ${show(tp)} is on the wrong side of the ${isBuy ? "buy" : "sell"} price ${show(referencePrice)}.`;
    }
  }

  if (sl != null && tp != null && (isBuy ? tp <= sl : tp >= sl)) {
    return `Take profit ${show(tp)} must sit beyond the stop loss ${show(sl)}.`;
  }

  return null;
}

// A limit must wait for price to come to it, a stop must trigger as price runs
// away. Orders placed on the wrong side fill instantly and are rejected.
export function validatePendingPrice({ orderType, side, price, marketPrice }) {
  if (!Number.isFinite(price) || price <= 0) {
    return "Pending orders need an entry price above 0.";
  }

  if (!Number.isFinite(marketPrice) || marketPrice <= 0) {
    return "There is no replayed candle to place a pending order against.";
  }

  const mustSitBelow = orderType === "LIMIT" ? side === "BUY" : side === "SELL";
  const satisfied = mustSitBelow ? price < marketPrice : price > marketPrice;

  if (satisfied) return null;

  return (
    `${side} ${orderType} ${price} is on the wrong side of the market (${marketPrice}). ` +
    `A ${side.toLowerCase()} ${orderType.toLowerCase()} must sit ${mustSitBelow ? "below" : "above"} the current price.`
  );
}

// One candle can breach both SL and TP. Without tick data the true sequence is
// unknowable, so the engine applies the configured deterministic rule instead
// of guessing randomly.
function resolveConflict(position, candle, rule) {
  const slHit = levelTouched(position.sl, candle, position.side, true);
  const tpHit = levelTouched(position.tp, candle, position.side, false);

  if (!slHit && !tpHit) return null;

  if (slHit && tpHit) {
    let slFirst;

    if (rule === SAME_CANDLE_RULES.TP_FIRST) slFirst = false;
    else if (rule === SAME_CANDLE_RULES.NEAREST_TO_OPEN) {
      slFirst = Math.abs(candle.open - position.sl) <= Math.abs(candle.open - position.tp);
    } else slFirst = true;

    return slFirst
      ? { kind: "sl", price: position.sl, conflicted: true }
      : { kind: "tp", price: position.tp, conflicted: true };
  }

  return slHit
    ? { kind: "sl", price: position.sl }
    : { kind: "tp", price: position.tp };
}

// A level only ever fills at the candle open when the open is already beyond
// it: a gap through a stop is worse than the stop, a gap through a target is
// better than the target. Anything else fills at the level the trader set.
function gapAdjustedExit(position, candle, hit, spec, settings) {
  const offset = sideOffset({
    spec,
    spreadPips: settings.spreadPips,
    slippagePips: settings.slippagePips,
    side: position.side === "BUY" ? "SELL" : "BUY",
  });

  const isBuy = position.side === "BUY";
  const stop = hit.kind === "sl";

  const worseOrBetter = isBuy
    ? (stop ? Math.min : Math.max)
    : (stop ? Math.max : Math.min);

  return worseOrBetter(candle.open, hit.price) + offset;
}

export function runBacktest({
  candles = [],
  actions = [],
  settings = {},
  symbol = "EURUSD",
  visibleCount = candles.length,
}) {
  const spec = getSymbolSpec(symbol);
  const config = { ...DEFAULT_BACKTEST_SETTINGS, ...settings };
  const startingBalance = Number(config.initialBalance) || 0;

  const empty = {
    symbol,
    balance: startingBalance,
    equity: startingBalance,
    usedMargin: 0,
    freeMargin: startingBalance,
    marginLevel: null,
    unrealizedPnl: 0,
    realizedPnl: 0,
    positions: [],
    orders: [],
    trades: [],
    rejections: [],
    markers: [],
    equityCurve: [],
    peakEquity: startingBalance,
    maxDrawdown: 0,
    maxDrawdownPct: 0,
    currentPrice: null,
    pipValuePerLot: null,
    settings: config,
    processedCandles: 0,
    fatalError: null,
  };

  if (!spec) {
    return { ...empty, fatalError: `No contract specification is defined for ${symbol}.` };
  }

  if (candles.length === 0) return empty;

  const pipValueAt = (price) =>
    positionPnl({
      symbol,
      side: "BUY",
      entry: price - spec.pipSize,
      price,
      volume: 1,
      accountCurrency: config.accountCurrency,
    });

  if (pipValueAt(candles[0].close) == null) {
    return {
      ...empty,
      fatalError:
        `A ${config.accountCurrency} account cannot convert ${spec.quote} profit for ${symbol}. ` +
        "Use an account currency in the symbol, or import that pair's history as a second series.",
    };
  }

  const marginFor = (volume, price) =>
    requiredMargin({
      symbol,
      price,
      volume,
      accountCurrency: config.accountCurrency,
      leverage: config.leverage,
    });

  const pnlOf = (side, entry, price, volume) =>
    positionPnl({ symbol, side, entry, price, volume, accountCurrency: config.accountCurrency }) || 0;

  const state = {
    currentIndex: 0,
    balance: startingBalance,
    equity: startingBalance,
    usedMargin: 0,
    positions: [],
    orders: [],
    trades: [],
    rejections: [],
    markers: [],
    equityCurve: [],
    peakEquity: startingBalance,
    maxDrawdown: 0,
    maxDrawdownPct: 0,
  };

  const unrealizedAt = (price) =>
    state.positions.reduce(
      (sum, position) => sum + pnlOf(position.side, position.entryPrice, price, position.volume),
      0
    );

  const freeMargin = () => state.equity - state.usedMargin;

  function closeTrade(position, price, time, reason, volume) {
    const closedVolume = Math.min(Number(volume) || position.volume, position.volume);
    if (closedVolume <= 0) return;

    const share = closedVolume / position.volume;
    const gross = pnlOf(position.side, position.entryPrice, price, closedVolume);
    const commission = config.commissionPerLot * closedVolume + position.commissionAtOpen * share;
    const nights = Math.floor(Math.max(0, time - position.openedAt) / NIGHT_MS);
    // Swap is a signed broker figure: negative costs the account, positive pays it.
    const swap = config.swapPerLotPerNight * closedVolume * nights;
    const net = gross - commission + swap;

    state.balance += net;
    state.usedMargin -= position.margin * share;

    const riskForSlice = position.riskAmount * share;

    state.trades.unshift({
      id: `${position.id}:${reason.code}:${time}`,
      mode: BACKTEST_MODE,
      symbol,
      side: position.side,
      volume: closedVolume,
      entryPrice: position.entryPrice,
      exitPrice: price,
      stopLoss: position.sl,
      takeProfit: position.tp,
      grossPnl: round(gross),
      commission: round(commission),
      swap: round(swap),
      netPnl: round(net),
      rMultiple: riskForSlice > 0 ? round(net / riskForSlice, 3) : null,
      pips: round((price - position.entryPrice) / spec.pipSize, 1),
      openedAtIndex: position.openedAtIndex,
      closedAtIndex: state.currentIndex,
      openedAt: position.openedAt,
      closedAt: time,
      durationMs: Math.max(0, time - position.openedAt),
      exitReason: reason.label,
      sameCandleConflict: reason.conflicted || false,
      notes: position.notes || "",
    });

    state.markers.push({
      id: `${position.id}:${reason.code}:exit`,
      atIndex: state.currentIndex,
      time,
      kind: "exit",
      price,
      positionId: position.id,
    });

    if (closedVolume >= position.volume - 1e-9) {
      state.positions = state.positions.filter((p) => p.id !== position.id);
    } else {
      position.riskAmount = position.riskAmount * (1 - share);
      position.commissionAtOpen = position.commissionAtOpen * (1 - share);
      position.volume = Number((position.volume - closedVolume).toFixed(2));
      position.margin = marginFor(position.volume, position.entryPrice) || 0;
    }
  }

  function openTrade(action, fillPrice, time, atIndex) {
    const volume = normalizedVolume(action.volume);

    if (volume == null) {
      state.rejections.push({
        atIndex,
        time,
        message: `Volume "${action.volume}" is invalid. Use ${MIN_LOT}–${MAX_LOT} lots in ${LOT_STEP} steps.`,
      });
      return;
    }

    const levelError = validateLevels({
      side: action.side,
      referencePrice: fillPrice,
      digits: spec.digits,
      sl: action.sl,
      tp: action.tp,
    });

    if (levelError) {
      state.rejections.push({ atIndex, time, message: levelError });
      return;
    }

    const margin = marginFor(volume, fillPrice);

    if (margin == null) {
      state.rejections.push({
        atIndex,
        time,
        message: `Margin cannot be calculated for ${symbol} in a ${config.accountCurrency} account.`,
      });
      return;
    }

    if (margin > freeMargin() + 1e-9) {
      state.rejections.push({
        atIndex,
        time,
        message:
          `Not enough free margin for ${action.side} ${volume} ${symbol}: ` +
          `needs ${margin.toFixed(2)}, free ${freeMargin().toFixed(2)} ${config.accountCurrency}.`,
      });
      return;
    }

    const slDistance = action.sl != null ? Math.abs(fillPrice - action.sl) : 0;
    const pipValue = pipValueAt(fillPrice);
    const riskAmount =
      slDistance > 0 && pipValue ? (slDistance / spec.pipSize) * pipValue * volume : 0;

    state.positions.push({
      id: action.id,
      mode: BACKTEST_MODE,
      symbol,
      side: action.side,
      volume,
      entryPrice: fillPrice,
      sl: action.sl ?? null,
      tp: action.tp ?? null,
      openedAtIndex: atIndex,
      openedAt: time,
      margin,
      riskAmount,
      commissionAtOpen: config.commissionPerLot * volume,
      notes: action.notes || "",
    });

    state.usedMargin += margin;

    state.markers.push({
      id: `${action.id}:entry`,
      atIndex,
      time,
      kind: action.side === "BUY" ? "buy" : "sell",
      price: fillPrice,
      positionId: action.id,
    });
  }

  function applyAction(action, candle, atIndex) {
    const time = candle.time;

    switch (action.kind) {
      case "market": {
        if (action.side === "BUY" && !config.allowLong) {
          state.rejections.push({ atIndex, time, message: "Long entries are disabled in backtest settings." });
          return;
        }
        if (action.side === "SELL" && !config.allowShort) {
          state.rejections.push({ atIndex, time, message: "Short entries are disabled in backtest settings." });
          return;
        }

        const offset = sideOffset({
          spec,
          spreadPips: config.spreadPips,
          slippagePips: config.slippagePips,
          side: action.side,
        });

        openTrade(action, candle.close + offset, time, atIndex);
        return;
      }

      case "pending": {
        const volume = normalizedVolume(action.volume);

        if (!Number.isFinite(action.price)) {
          state.rejections.push({ atIndex, time, message: "Pending order needs a valid entry price." });
          return;
        }
        if (volume == null) {
          state.rejections.push({ atIndex, time, message: `Pending volume "${action.volume}" is invalid.` });
          return;
        }

        const priceError = validatePendingPrice({
          orderType: action.orderType,
          side: action.side,
          price: action.price,
          marketPrice: candle.close,
        });

        if (priceError) {
          state.rejections.push({ atIndex, time, message: priceError });
          return;
        }

        const levelError = validateLevels({
          side: action.side,
          referencePrice: action.price,
      digits: spec.digits,
          sl: action.sl,
          tp: action.tp,
        });

        if (levelError) {
          state.rejections.push({ atIndex, time, message: levelError });
          return;
        }
        if (
          (action.side === "BUY" && !config.allowLong) ||
          (action.side === "SELL" && !config.allowShort)
        ) {
          state.rejections.push({
            atIndex,
            time,
            message: `${action.side} orders are disabled in backtest settings.`,
          });
          return;
        }

        state.orders.push({
          id: action.id,
          mode: BACKTEST_MODE,
          symbol,
          orderType: action.orderType,
          side: action.side,
          price: action.price,
          volume,
          sl: action.sl ?? null,
          tp: action.tp ?? null,
          createdAt: time,
          createdAtIndex: atIndex,
          notes: action.notes || "",
        });
        return;
      }

      case "cancel": {
        if (!state.orders.some((o) => o.id === action.orderId)) return;
        state.orders = state.orders.filter((o) => o.id !== action.orderId);
        return;
      }

      case "modify": {
        const position = state.positions.find((p) => p.id === action.positionId);
        const order = position ? null : state.orders.find((o) => o.id === action.orderId);

        if (order) {
          const orderLevelError = validateLevels({
            side: order.side,
            referencePrice: order.price,
            sl: action.sl !== undefined ? action.sl : order.sl,
            tp: action.tp !== undefined ? action.tp : order.tp,
            digits: spec.digits,
          });

          if (orderLevelError) {
            state.rejections.push({ atIndex, time, message: orderLevelError });
            return;
          }

          if (action.sl !== undefined) order.sl = action.sl;
          if (action.tp !== undefined) order.tp = action.tp;
          if (action.notes !== undefined) order.notes = action.notes;
          return;
        }

        if (!position) return;

        const nextSl = action.sl !== undefined ? action.sl : position.sl;
        const nextTp = action.tp !== undefined ? action.tp : position.tp;

        const levelError = validateLevels({
          side: position.side,
          referencePrice: position.entryPrice,
      digits: spec.digits,
          sl: nextSl,
          tp: nextTp,
        });

        if (levelError) {
          state.rejections.push({ atIndex, time, message: levelError });
          return;
        }

        position.sl = nextSl ?? null;
        position.tp = nextTp ?? null;
        if (action.notes !== undefined) position.notes = action.notes;

        const pipValue = pipValueAt(candle.close);
        position.riskAmount =
          nextSl != null && pipValue
            ? (Math.abs(position.entryPrice - nextSl) / spec.pipSize) * pipValue * position.volume
            : 0;
        return;
      }

      case "close": {
        const position = state.positions.find((p) => p.id === action.positionId);
        if (!position) return;

        const offset = sideOffset({
          spec,
          spreadPips: config.spreadPips,
          slippagePips: config.slippagePips,
          side: position.side === "BUY" ? "SELL" : "BUY",
        });

        closeTrade(position, candle.close + offset, time, { label: "Manual", code: "manual" }, action.volume);
        return;
      }

      case "closeAll": {
        for (const position of [...state.positions]) {
          const offset = sideOffset({
            spec,
            spreadPips: config.spreadPips,
            slippagePips: config.slippagePips,
            side: position.side === "BUY" ? "SELL" : "BUY",
          });

          closeTrade(
            position,
            candle.close + offset,
            time,
            { label: "End of Test", code: "eot" }
          );
        }

        state.orders = [];
        return;
      }

      default:
        return;
    }
  }

  // A saved journal is data, not a command. The same click id may only be
  // applied once, otherwise a duplicated or hand-edited entry fills twice.
  const actionsByIndex = new Map();
  const seenActionIds = new Set();
  for (const action of actions) {
    if (action.id != null) {
      if (seenActionIds.has(action.id)) {
        state.rejections.push({
          atIndex: action.at,
          time: candles[action.at - 1]?.time ?? null,
          message: `Duplicate journal entry ${action.id} was ignored.`,
        });
        continue;
      }
      seenActionIds.add(action.id);
    }

    const list = actionsByIndex.get(action.at);
    if (list) list.push(action);
    else actionsByIndex.set(action.at, [action]);
  }

  const total = Math.min(visibleCount, candles.length);

  for (let i = 1; i <= total; i += 1) {
    const candle = candles[i - 1];
    state.currentIndex = i;

    // 1. Pending orders may only trigger on candles that are now revealed.
    for (const order of [...state.orders]) {
      const fill = pendingFillPrice(order, candle, spec, config);
      if (fill == null) continue;

      state.orders = state.orders.filter((o) => o.id !== order.id);
      openTrade(
        {
          id: order.id,
          side: order.side,
          volume: order.volume,
          sl: order.sl,
          tp: order.tp,
          notes: order.notes,
        },
        fill,
        candle.time,
        i
      );
    }

    // 2. Protective levels are evaluated before the trader acts on this candle.
    for (const position of [...state.positions]) {
      const hit = resolveConflict(position, candle, config.sameCandleRule);
      if (!hit) continue;

      closeTrade(position, gapAdjustedExit(position, candle, hit, spec, config), candle.time, {
        label: hit.kind === "sl" ? EXIT_REASONS.STOP_LOSS : EXIT_REASONS.TAKE_PROFIT,
        code: hit.kind,
        conflicted: hit.conflicted,
      });
    }

    // 3-5. Mark to market, refresh balance-linked equity and record the curve.
    state.equity = state.balance + unrealizedAt(candle.close);

    // A leveraged account is force-closed by the broker before it goes
    // insolvent, so the simulation refuses to carry a negative balance forward.
    const stopOutFloor = (state.usedMargin * config.stopOutLevelPct) / 100;
    if (
      config.stopOutLevelPct > 0 &&
      state.usedMargin > 0 &&
      state.equity <= stopOutFloor
    ) {
      const worstFirst = [...state.positions].sort(
        (a, b) =>
          pnlOf(a.side, a.entryPrice, candle.close, a.volume) -
          pnlOf(b.side, b.entryPrice, candle.close, b.volume)
      );

      let forceClosed = 0;
      for (const position of worstFirst) {
        const offset = sideOffset({
          spec,
          spreadPips: config.spreadPips,
          slippagePips: config.slippagePips,
          side: position.side === "BUY" ? "SELL" : "BUY",
        });

        closeTrade(position, candle.close + offset, candle.time, {
          label: "Margin Call",
          code: "stopout",
        });
        forceClosed += 1;

        state.equity = state.balance + unrealizedAt(candle.close);
        if (state.usedMargin <= 0 || state.equity > (state.usedMargin * config.stopOutLevelPct) / 100) break;
      }

      if (forceClosed > 0) {
        state.rejections.push({
          atIndex: i,
          time: candle.time,
          message:
            `Margin call: equity dropped to or below ${config.stopOutLevelPct}% of used margin, ` +
            `so ${forceClosed} position(s) were force-closed at the candle price.`,
        });
      }
    }

    if (state.equity > state.peakEquity) state.peakEquity = state.equity;

    const drawdown = state.peakEquity - state.equity;
    if (drawdown > state.maxDrawdown) state.maxDrawdown = drawdown;

    const drawdownPct = state.peakEquity > 0 ? (drawdown / state.peakEquity) * 100 : 0;
    if (drawdownPct > state.maxDrawdownPct) state.maxDrawdownPct = drawdownPct;

    state.equityCurve.push({
      index: i,
      time: candle.time,
      balance: round(state.balance),
      equity: round(state.equity),
      drawdown: round(drawdown),
      drawdownPct: round(drawdownPct, 3),
    });

    // 6. Only now does the trader get to act on the candle they can see.
    for (const action of actionsByIndex.get(i) || []) {
      applyAction(action, candle, i);
    }
  }

  const lastPrice = total > 0 ? candles[total - 1].close : null;
  const unrealizedPnl = lastPrice == null ? 0 : unrealizedAt(lastPrice);

  return {
    symbol,
    balance: round(state.balance),
    equity: round(state.equity),
    usedMargin: round(state.usedMargin),
    freeMargin: round(freeMargin()),
    marginLevel: state.usedMargin > 0 ? round((state.equity / state.usedMargin) * 100, 1) : null,
    unrealizedPnl: round(unrealizedPnl),
    realizedPnl: round(state.trades.reduce((sum, trade) => sum + trade.netPnl, 0)),
    positions: state.positions,
    orders: state.orders,
    trades: state.trades,
    rejections: state.rejections,
    markers: state.markers,
    equityCurve: state.equityCurve,
    peakEquity: round(state.peakEquity),
    maxDrawdown: round(state.maxDrawdown),
    maxDrawdownPct: round(state.maxDrawdownPct, 2),
    currentPrice: lastPrice,
    pipValuePerLot: lastPrice == null ? null : pipValueAt(lastPrice),
    settings: config,
    processedCandles: total,
    fatalError: null,
  };
}

export function nearestCandleIndex(candles, timestamp) {
  let best = -1;
  let bestGap = Infinity;

  for (let i = 0; i < candles.length; i += 1) {
    const gap = Math.abs(candles[i].time - timestamp);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  }

  return best === -1 ? null : best + 1;
}
