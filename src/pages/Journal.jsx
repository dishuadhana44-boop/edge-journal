import { useMemo, useState } from "react";
import MonthlyCalendar from "../components/journal/MonthlyCalendar";
import WeeklyPnL from "../components/journal/WeeklyPnL";

import { useJournal } from "../context/JournalContext";

export default function Journal() {

  const [currentDate, setCurrentDate] = useState(new Date());

  const { filteredTrades } = useJournal();

      const tradeMap = useMemo(() => {

        const map = {};
    
        filteredTrades.forEach((trade) => {
    
            if (!map[trade.date]) {
    
                map[trade.date] = {
    
                    pnl: 0,
                    trades: 0,
    
                };
    
            }
    
            map[trade.date].pnl += Number(trade.pnl);
    
            map[trade.date].trades++;
    
        });
    
        return map;
    
      }, [filteredTrades]);

    const monthlyPnL = useMemo(() => {

      return filteredTrades.reduce((total, trade) => {
  
          const tradeDate = new Date(trade.date);
  
          if (
  
              tradeDate.getMonth() !== currentDate.getMonth() ||
  
              tradeDate.getFullYear() !== currentDate.getFullYear()
  
          ) return total;
  
          const pnl = Number(
  
              String(trade.pnl)
  
                  .replace(/[₹,$+\s]/g, "")
  
                  .replace(/,/g, "")
  
          );
  
          return total +
  
              (String(trade.pnl).startsWith("-")
  
                  ? -Math.abs(pnl)
  
                  : Math.abs(pnl));
  
      }, 0);
  
    }, [filteredTrades, currentDate]);

  const weeklyData = useMemo(() => {

    const weeks = {

        1: { pnl: 0, trades: 0, wins: 0 },

        2: { pnl: 0, trades: 0, wins: 0 },

        3: { pnl: 0, trades: 0, wins: 0 },

        4: { pnl: 0, trades: 0, wins: 0 },

        5: { pnl: 0, trades: 0, wins: 0 },

    };

    filteredTrades.forEach((trade) => {

        const tradeDate = new Date(trade.date);

        if (

            tradeDate.getMonth() !== currentDate.getMonth() ||

            tradeDate.getFullYear() !== currentDate.getFullYear()

        ) return;

        const week = Math.ceil(tradeDate.getDate() / 7);

        const pnl = Number(

            String(trade.pnl)

                .replace(/[₹,$+\s]/g, "")

                .replace(/,/g, "")

        );

        weeks[week].pnl +=

            String(trade.pnl).startsWith("-")

                ? -Math.abs(pnl)

                : Math.abs(pnl);

        weeks[week].trades++;

        if (trade.result === "Win") {

            weeks[week].wins++;

        }

    });

    return weeks;

  }, [filteredTrades, currentDate]);

  return (
    <div className="max-w-[1450px] mx-auto px-1 py-1">

      {/* Header */}

      <div className="mb-4">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-4">

            <h1 className="text-2xl font-bold text-gray-900">
              Journal
            </h1>

            <p className="text-gray-500">
              Review your trades, emotions and patterns to build consistency and self-awareness.
            </p>

          </div>

          <button
            className="
            bg-violet-600
            hover:bg-violet-700
            text-white
            rounded-xl
            px-5
            py-2.5
            font-medium
            shadow-sm
            transition-all
            duration-200
            hover:scale-105
            "
          >
            + Add Journal Entry
          </button>

        </div>

      </div>

      {/* Content */}

      <div className="grid grid-cols-12 gap-4">

        <div className="col-span-9">

        <MonthlyCalendar
  currentDate={currentDate}
  setCurrentDate={setCurrentDate}
  trades={filteredTrades}
/>

        </div>

        <div className="col-span-3">

        <div
  className="
  bg-white
  rounded-3xl
  border
  border-gray-200
  overflow-hidden
  "
>

  {/* Header */}



  {/* Body */}

  <div className="p-5">

  <WeeklyPnL
  currentDate={currentDate}
  trades={filteredTrades}
/>

  </div>

</div>

        </div>

      </div>

    </div>
  );
}
