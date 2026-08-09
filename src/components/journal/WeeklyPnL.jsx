import { useMemo } from "react";
import {
    TrendingUp,
    TrendingDown,
    Target,
    DollarSign,
  } from "lucide-react";
  
  export default function WeeklyPnL({
    currentDate,
    trades,
}) {

    const journalTrades = trades || [];

  const currentMonth = currentDate.getMonth();

  const currentYear = currentDate.getFullYear();

  const weeklyData = useMemo(() => {

    const weeks = [
        {
            title: "Week 1",
            pnl: 0,
            trades: 0,
            wins: 0,
        },
        {
            title: "Week 2",
            pnl: 0,
            trades: 0,
            wins: 0,
        },
        {
            title: "Week 3",
            pnl: 0,
            trades: 0,
            wins: 0,
        },
        {
            title: "Week 4",
            pnl: 0,
            trades: 0,
            wins: 0,
        },
        {
            title: "Week 5",
            pnl: 0,
            trades: 0,
            wins: 0,
        },
    ];

    journalTrades.forEach((trade) => {

        if (!trade.date) return;

        const d = new Date(trade.date);

        if (
            d.getMonth() !== currentMonth ||
            d.getFullYear() !== currentYear
        )
            return;

        const weekIndex = Math.floor((d.getDate() - 1) / 7);

        if (!weeks[weekIndex]) return;

        const pnl = Number(
            String(trade.pnl)
              .replace(/[₹$,\s]/g, "")
          );
          
          weeks[weekIndex].pnl += pnl;
          
          // Trade count
          weeks[weekIndex].trades++;
          console.log({
            pair: trade.pair,
            result: trade.result,
            pnl: trade.pnl,
            week: weekIndex + 1,
          });
          
          // Win count
          if (trade.result === "Win") {
            weeks[weekIndex].wins++;
          }

    });

    return weeks.map((week) => ({
        ...week,
        winRate:
          week.trades === 0
            ? 0
            : Math.round((week.wins / week.trades) * 100),
      }));

}, [journalTrades, currentMonth, currentYear]);

    return (

        <div className="space-y-1">

{weeklyData.map((data, index) => {



          const bestPnL = Math.max(...weeklyData.map(w => w.pnl));

          const totalTrades = weeklyData.reduce(
            (sum, week) => sum + week.trades,
            0
          );

          const isBestWeek =
              data.pnl === bestPnL &&
              bestPnL > 0;      

return (

    <div
        key={index}
        className="bg-white border border-gray-200 rounded-2xl p-3 hover:border-violet-300 transition"
    >

<div className="flex items-center justify-between">

    <div>

        <div className="flex items-center gap-2">

            <h3 className="font-bold text-gray-900">
                {data.title}
            </h3>

            {isBestWeek && (

                <span
                    className="
                    px-2
                    py-0.5
                    rounded-full
                    bg-yellow-100
                    text-yellow-700
                    text-[10px]
                    font-bold
                    "
                >
                    🏆 BEST
                </span>

            )}

        </div>

       

    </div>

    <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            data.pnl >= 0
                ? "bg-green-100"
                : "bg-red-100"
        }`}
    >

        {data.pnl >= 0 ? (
            <TrendingUp
                size={20}
                className="text-green-600"
            />
        ) : (
            <TrendingDown
                size={20}
                className="text-red-600"
            />
        )}

    </div>

</div>

        <div
            className={`text-xl font-bold  ${
                data.pnl >= 0
                    ? "text-green-600"
                    : "text-red-600"
            }`}
        >
            {data.pnl >= 0 ? "+" : "-"}$
            {Math.abs(data.pnl).toLocaleString()}
        </div>
        <div className="grid grid-cols-2 gap-4 mt-1">

<div>

    <p className="text-xs text-gray-500">

        Trades

    </p>

    <p className="font-bold">

        {data.trades}

    </p>

</div>

<div>

<div>

<p className="text-xs text-gray-500">
    Win Rate
</p>

<p className="font-bold text-violet-600">
{data.winRate}%
</p>

</div>

</div>

</div>
    </div>

);

})}

        </div>

    );

}