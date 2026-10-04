import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useTrade } from "../../../context/TradeContext";

function getNumber(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      const number = Number(value);

      if (Number.isFinite(number)) {
        return number;
      }
    }
  }

  return 0;
}

function getTradeValue(trade, keys = []) {
  if (!trade) return undefined;

  const sources = [
    trade,
    trade.position,
    trade.tradeData,
    trade.tradeData?.position,
    trade.data,
    trade.data?.position,
  ];

  for (const source of sources) {
    if (!source) continue;

    for (const key of keys) {
      if (
        source[key] !== undefined &&
        source[key] !== null &&
        source[key] !== ""
      ) {
        return source[key];
      }
    }
  }

  return undefined;
}

function getOpenTimestamp(trade) {
  if (!trade) return null;

  const sources = [
    trade,
    trade.position,
    trade.tradeData,
    trade.tradeData?.position,
    trade.data,
    trade.data?.position,
  ];

  const millisecondKeys = [
    "time_msc",
    "timeMsc",
    "openTimeMsc",
    "openedAtMsc",
    "timestampMsc",
    "openTimestampMsc",
  ];

  const secondKeys = [
    "time",
    "openTimestamp",
    "openedAt",
    "openTime",
    "timestamp",
    "createdAt",
  ];

  for (const source of sources) {
    if (!source) continue;

    for (const key of millisecondKeys) {
      const value = source[key];

      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        const number = Number(value);

        if (Number.isFinite(number) && number > 0) {
          return number >= 100000000000
            ? number
            : number * 1000;
        }
      }
    }
  }

  for (const source of sources) {
    if (!source) continue;

    for (const key of secondKeys) {
      const value = source[key];

      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        continue;
      }

      const number = Number(value);

      if (Number.isFinite(number) && number > 0) {
        return number < 100000000000
          ? number * 1000
          : number;
      }

      const parsed = new Date(value).getTime();

      if (
        Number.isFinite(parsed) &&
        parsed > 0
      ) {
        return parsed;
      }
    }
  }

  return null;
}

function normalizeSide(value, trade) {
  const broker = String(
    trade?.broker ||
      trade?.source ||
      ""
  ).toUpperCase();

  if (broker === "MT5") {
    const numericType = Number(
      getTradeValue(trade, [
        "type",
        "positionType",
      ])
    );

    if (numericType === 0) return "buy";
    if (numericType === 1) return "sell";
  }

  const numericSide = Number(value);

  if (numericSide === 1) return "buy";
  if (numericSide === 2) return "sell";

  const normalized = String(
    value || ""
  ).toLowerCase();

  if (
    normalized === "buy" ||
    normalized === "long"
  ) {
    return "buy";
  }

  if (
    normalized === "sell" ||
    normalized === "short"
  ) {
    return "sell";
  }

  return normalized;
}

function getPnL(trade) {
  return getNumber(
    getTradeValue(trade, [
      "pnl",
      "profit",
      "netProfit",
      "netPnL",
      "unrealizedPnL",
      "unrealizedPnl",
    ])
  );
}

function formatPrice(value) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return "—";
  }

  return number.toFixed(5);
}

function formatLots(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0.00";
  }

  return number.toFixed(2);
}

function formatPnL(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "$0.00";
  }

  return `${number >= 0 ? "+" : "-"}$${Math.abs(
    number
  ).toFixed(2)}`;
}

function formatDuration(openTimestamp, now) {
  if (!openTimestamp) {
    return "—";
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor(
      (now - openTimestamp) / 1000
    )
  );

  const hours = Math.floor(
    elapsedSeconds / 3600
  );

  const minutes = Math.floor(
    (elapsedSeconds % 3600) / 60
  );

  const seconds =
    elapsedSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export default function RecentTradesCard() {
  const navigate = useNavigate();

  const {
    openTrades = [],
  } = useTrade();

  const [now, setNow] = useState(
    Date.now()
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const recentPositions = [...openTrades]
    .sort((a, b) => {
      const aTime =
        getOpenTimestamp(a) || 0;

      const bTime =
        getOpenTimestamp(b) || 0;

      return bTime - aTime;
    })
    .slice(0, 5);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      <div className="flex items-center justify-between px-6 py-2 border-b border-gray-200">

        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Open Positions
          </h2>

          
        </div>

        <button
          type="button"
          onClick={() => navigate("/trading")}
          className="text-sm font-medium text-violet-600 hover:text-violet-700 transition"
        >
          View All →
        </button>

      </div>

      {recentPositions.length === 0 ? (
        <div className="flex items-center justify-center py-17">

          <div className="text-center">

            <p className="text-sm font-medium text-gray-600">
              No open positions
            </p>

            <p className="text-xs text-gray-400 mt-1">
              Open positions from your trading terminal will appear here.
            </p>

          </div>

        </div>
      ) : (

        <div className="overflow-x-auto">

          <table className="w-full min-w-[950px]">

            <thead className="bg-gray-50 border-b border-gray-200">

              <tr>

                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Instrument
                </th>

                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Side
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Lots
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Entry
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Current
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  P/L
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Duration
                </th>

              </tr>

            </thead>

            <tbody>

              {recentPositions.map(
                (trade, index) => {

                  const symbol =
                    getTradeValue(trade, [
                      "symbol",
                      "instrument",
                      "symbolName",
                    ]) || "UNKNOWN";

                  const rawSide =
                    getTradeValue(trade, [
                      "side",
                      "direction",
                      "tradeSide",
                      "type",
                      "positionType",
                    ]);

                  const side =
                    normalizeSide(
                      rawSide,
                      trade
                    );

                  const quantity =
                    getNumber(
                      getTradeValue(
                        trade,
                        [
                          "quantity",
                          "lots",
                          "volumeLots",
                          "volume",
                        ]
                      )
                    );

                  const entry =
                    getNumber(
                      getTradeValue(
                        trade,
                        [
                          "entry",
                          "entryPrice",
                          "priceOpen",
                          "price_open",
                          "price",
                          "openPrice",
                        ]
                      )
                    );

                  const currentPrice =
                    getNumber(
                      getTradeValue(
                        trade,
                        [
                          "currentPrice",
                          "current",
                          "priceCurrent",
                          "price_current",
                          "markPrice",
                          "bid",
                          "ask",
                        ]
                      )
                    ) || entry;

                  const pnl =
                    getPnL(trade);

                  const openedAt =
                    getOpenTimestamp(
                      trade
                    );

                  const tradeId =
                    trade?.id ??
                    trade?.brokerPositionId ??
                    trade?.positionId ??
                    trade?.ticket ??
                    index;

                  return (
                    <tr
                      key={tradeId}
                      onClick={() =>
                        navigate(
                          "/trading"
                        )
                      }
                      className="border-b border-gray-100 last:border-none hover:bg-gray-50 cursor-pointer transition"
                    >

                      <td className="px-6 py-3">

                        <div className="flex items-center gap-3">

                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-700">
                            {String(symbol)
                              .slice(0, 3)
                              .toUpperCase()}
                          </div>

                          <div>

                            <div className="font-semibold text-gray-900">
                              {symbol}
                            </div>

                            <div className="text-[11px] text-gray-400">
                              MT5 Position
                            </div>

                          </div>

                        </div>

                      </td>

                      <td className="px-4 py-3 text-center">

                        <div
                          className={`inline-flex items-center gap-1 text-sm font-semibold ${
                            side === "buy"
                              ? "text-emerald-600"
                              : side === "sell"
                              ? "text-red-600"
                              : "text-gray-500"
                          }`}
                        >

                          {side === "buy" ? (
                            <ArrowUpRight
                              size={15}
                            />
                          ) : side === "sell" ? (
                            <ArrowDownRight
                              size={15}
                            />
                          ) : null}

                          {side
                            ? side
                                .charAt(0)
                                .toUpperCase() +
                              side.slice(1)
                            : "—"}

                        </div>

                      </td>

                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {formatLots(
                          quantity
                        )}
                      </td>

                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {formatPrice(
                          entry
                        )}
                      </td>

                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {formatPrice(
                          currentPrice
                        )}
                      </td>

                      <td
                        className={`px-4 py-3 text-right text-sm font-semibold ${
                          pnl >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {formatPnL(pnl)}
                      </td>

                      <td className="px-6 py-3 text-right text-sm text-gray-500 font-mono">
                        {formatDuration(
                          openedAt,
                          now
                        )}
                      </td>

                    </tr>
                  );
                }
              )}

            </tbody>

          </table>

        </div>
      )}

    </div>
  );
}