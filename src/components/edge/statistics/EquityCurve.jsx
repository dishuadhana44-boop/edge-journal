import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  CartesianGrid,
} from "recharts";

import { useMemo, useState } from "react";
import { useJournal } from "../../../context/JournalContext";

export default function EquityCurve({ plan }) {
  const { trades = [], selectedAccountId } = useJournal();

  const [range, setRange] = useState("ALL");

  // -----------------------------------------
  // CURRENT ACCOUNT
  // -----------------------------------------

  const accounts =
    JSON.parse(localStorage.getItem("tradingAccounts")) || [];

  const currentAccount =
    accounts.find(
      (account) =>
        Number(account.id) === Number(selectedAccountId)
    ) ||
    accounts.find((account) => account.isDefault) ||
    accounts[0];

  // -----------------------------------------
  // STARTING CAPITAL
  // -----------------------------------------

  const startingCapital =
    Number(
      currentAccount?.startingBalance
    ) || 0;

  // -----------------------------------------
  // PLAN TRADES
  // -----------------------------------------

  const planTrades = useMemo(() => {
    if (!plan?.id) return [];

    return trades
      .filter((trade) => {
        const selectedPlanId =
          trade?.reflection?.selectedPlanId ??
          trade?.selectedPlanId ??
          trade?.planId;

        return (
          String(selectedPlanId) ===
          String(plan.id)
        );
      })
      .filter((trade) => {
        const accountId =
          trade?.accountId ??
          trade?.account?.id;

        // Agar trade accountId rakhta hai,
        // to current account ke trades hi lo.
        if (
          accountId !== undefined &&
          selectedAccountId !== undefined
        ) {
          return (
            Number(accountId) ===
            Number(selectedAccountId)
          );
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(a.date || a.createdAt) -
          new Date(b.date || b.createdAt)
      );
  }, [trades, plan, selectedAccountId]);

  // -----------------------------------------
  // NORMALIZE PNL
  // -----------------------------------------

  const getPnL = (trade) => {
    const raw =
      trade?.pnl ??
      trade?.netPnL ??
      trade?.netPnl ??
      0;

    const value = Number(
      String(raw).replace(/[₹$,\s+]/g, "")
    );

    return Number.isFinite(value) ? value : 0;
  };

  // -----------------------------------------
  // BUILD FULL EQUITY CURVE
  // -----------------------------------------

  const fullChartData = useMemo(() => {
    let equity = startingCapital;
    let peak = startingCapital;

    return planTrades.map((trade, index) => {
      const pnl = getPnL(trade);

      equity += pnl;
      peak = Math.max(peak, equity);

      const drawdown =
        peak > 0
          ? ((peak - equity) / peak) * 100
          : 0;

      return {
        trade: index + 1,
        date:
          trade?.date ||
          trade?.createdAt ||
          null,
        equity,
        peak,
        pnl,
        drawdown,
        positive: pnl >= 0,
      };
    });
  }, [planTrades, startingCapital]);

  // -----------------------------------------
  // RANGE FILTER
  // -----------------------------------------

  const chartData = useMemo(() => {
    if (range === "ALL") {
      return fullChartData;
    }

    const months =
      range === "1M"
        ? 1
        : range === "3M"
        ? 3
        : 6;

    const today = new Date();

    return fullChartData.filter((item) => {
      if (!item.date) return true;

      const tradeDate = new Date(item.date);

      const diffMonths =
        (today.getFullYear() -
          tradeDate.getFullYear()) *
          12 +
        (today.getMonth() -
          tradeDate.getMonth());

      return diffMonths < months;
    });
  }, [fullChartData, range]);

  // -----------------------------------------
  // CURRENT EQUITY
  // -----------------------------------------

  const currentEquity =
    fullChartData.length > 0
      ? fullChartData[
          fullChartData.length - 1
        ].equity
      : startingCapital;

  // -----------------------------------------
  // NET PROFIT
  // -----------------------------------------

  const totalPnL =
    currentEquity - startingCapital;

  // -----------------------------------------
  // MAX DRAWDOWN
  // -----------------------------------------

  const maxDrawdown =
    fullChartData.length > 0
      ? Math.max(
          ...fullChartData.map(
            (item) => item.drawdown
          )
        )
      : 0;

  const lineColor =
    totalPnL >= 0
      ? "#22c55e"
      : "#ef4444";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">

      {/* HEADER */}

      <div className="flex items-center justify-between p-6 border-b">

        <div>
          <h2 className="text-xl font-bold">
            Equity Curve
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            {plan?.name ||
              plan?.title ||
              "Trading Plan"}
          </p>
        </div>

        <div className="flex gap-2">

          {["1M", "3M", "6M", "ALL"].map(
            (item) => (
              <button
                key={item}
                onClick={() =>
                  setRange(item)
                }
                className={`
                  px-3 py-1.5
                  rounded-lg
                  text-sm
                  ${
                    range === item
                      ? "bg-violet-600 text-white"
                      : "border bg-white"
                  }
                `}
              >
                {item}
              </button>
            )
          )}

        </div>
      </div>

      {/* STATS */}

      <div className="grid grid-cols-3 gap-6 p-6 border-b">

        <div>
          <p className="text-gray-500 text-sm">
            Current Equity
          </p>

          <h2
            className={`text-3xl font-bold mt-1 ${
              currentEquity >= 0
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            ${currentEquity.toLocaleString()}
          </h2>
        </div>

        <div>
          <p className="text-gray-500 text-sm">
            Net Profit
          </p>

          <h2
            className={`text-3xl font-bold mt-1 ${
              totalPnL >= 0
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {totalPnL >= 0 ? "+" : "-"}$
            {Math.abs(
              totalPnL
            ).toLocaleString()}
          </h2>
        </div>

        <div>
          <p className="text-gray-500 text-sm">
            Max Drawdown
          </p>

          <h2
            className={`text-3xl font-bold mt-1 ${
              maxDrawdown > 0
                ? "text-red-500"
                : "text-green-600"
            }`}
          >
            -{maxDrawdown.toFixed(2)}%
          </h2>
        </div>

      </div>

      {/* CHART */}

      <div className="h-[420px] p-6">

        {chartData.length === 0 ? (

          <div className="h-full flex flex-col items-center justify-center text-gray-400">

            <p>
              No trades for this plan yet
            </p>

            <p className="text-xs mt-2">
              Select this plan inside Advanced Journal
              trades.
            </p>

          </div>

        ) : (

          <ResponsiveContainer
            width="100%"
            height="100%"
          >

            <AreaChart
              data={chartData}
              margin={{
                top: 10,
                right: 20,
                left: 10,
                bottom: 10,
              }}
            >

              <defs>

                <linearGradient
                  id={`equityFill-${plan?.id}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >

                  <stop
                    offset="5%"
                    stopColor={lineColor}
                    stopOpacity={0.35}
                  />

                  <stop
                    offset="95%"
                    stopColor={lineColor}
                    stopOpacity={0}
                  />

                </linearGradient>

              </defs>

              <CartesianGrid
                stroke="#f1f1f1"
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                dataKey="trade"
                tickLine={false}
                axisLine={false}
              />

              <Tooltip
                contentStyle={{
                  borderRadius: 16,
                  border: "none",
                  boxShadow:
                    "0 10px 30px rgba(0,0,0,.12)",
                }}
                formatter={(value, name) => [
                  `$${Number(
                    value
                  ).toLocaleString()}`,
                  name === "equity"
                    ? "Equity"
                    : "Peak",
                ]}
                labelFormatter={(label) =>
                  `Trade #${label}`
                }
              />

              {/* PEAK */}

              <Area
                type="monotone"
                dataKey="peak"
                stroke="#94a3b8"
                strokeWidth={2}
                fillOpacity={0}
                strokeDasharray="6 6"
                isAnimationActive
              />

              {/* EQUITY */}

              <Area
                type="monotone"
                dataKey="equity"
                stroke={lineColor}
                strokeWidth={3}
                fill={`url(#equityFill-${plan?.id})`}
                animationDuration={1200}
                isAnimationActive
                activeDot={{
                  r: 7,
                  stroke: lineColor,
                  strokeWidth: 2,
                }}
                dot={(props) => {
                  const {
                    cx,
                    cy,
                    payload,
                  } = props;

                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill={
                        payload.positive
                          ? "#22c55e"
                          : "#ef4444"
                      }
                      stroke="white"
                      strokeWidth={2}
                    />
                  );
                }}
              />

            </AreaChart>

          </ResponsiveContainer>

        )}

      </div>

    </div>
  );
}