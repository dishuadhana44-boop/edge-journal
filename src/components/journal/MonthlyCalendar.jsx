import { useState, useMemo } from "react";
import CalendarDay from "./CalendarDay";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import DailyJournalModal from "./DailyJournalModal";

import { useNavigate } from "react-router-dom";

export default function MonthlyCalendar({
  currentDate,
  setCurrentDate,
}) {

    const navigate = useNavigate();

    const [selectedTrade, setSelectedTrade] = useState(null);


    const monthName = currentDate.toLocaleString("default", {
      month: "long",
    });
    
    const year = currentDate.getFullYear();
    
    const previousMonth = () => {
      setCurrentDate(
        new Date(
          year,
          currentDate.getMonth() - 1,
          1
        )
      );
    };
    
    const nextMonth = () => {
      setCurrentDate(
        new Date(
          year,
          currentDate.getMonth() + 1,
          1
        )
      );
    };
    
    const goToday = () => {
      setCurrentDate(new Date());
    };

    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    
    const daysInMonth = new Date(
      year,
      month + 1,
      0
    ).getDate();
    
    const calendarDays = [];
    
    /* Monday Start */
    
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    
    /* Empty Boxes */
    
    for (let i = 0; i < offset; i++) {
    
      calendarDays.push(null);
    
    }
    
    /* Days */
    
    for (let i = 1; i <= daysInMonth; i++) {
    
      calendarDays.push(i);
    
    }

    // Always render 6 weeks (42 cells)

while (calendarDays.length < 42) {
  calendarDays.push(null);
}

    const trades = JSON.parse(
        localStorage.getItem("trades")
      ) || [];
      
      const tradeMap = useMemo(() => {

        const map = {};
    
        trades.forEach((trade) => {
    
            const key = trade.date;
    
            if (!map[key]) {
    
                map[key] = {
    
                    pnl: 0,
    
                    trades: 0,
    
                    wins: 0,
    
                    losses: 0,
    
                    totalRR: 0,
    
                };
    
            }
    
            // -------- PnL --------
    
            const pnl = Number(
    
                String(trade.pnl)
    
                    .replace(/[₹,$+\s]/g, "")
    
                    .replace(/,/g, "")
    
            );
    
            map[key].pnl +=
    
                String(trade.pnl).startsWith("-")
    
                    ? -Math.abs(pnl)
    
                    : Math.abs(pnl);
    
            // -------- Trades --------
    
            map[key].trades++;
    
            // -------- Win Loss --------
    
            if (trade.result === "Win") {
    
                map[key].wins++;
    
            } else {
    
                map[key].losses++;
    
            }
    
            // -------- RR --------
    
            const rr = parseFloat(trade.rr || 0);
    
            if (!isNaN(rr)) {
    
                map[key].totalRR += rr;
    
            }
    
        });
    
        return map;
    
    }, [trades]);

    const monthlyPnL = useMemo(() => {

      return trades.reduce((total, trade) => {
  
          const tradeDate = new Date(trade.date);
  
          // Sirf selected month aur year ke trades
          if (
              tradeDate.getMonth() !== currentDate.getMonth() ||
              tradeDate.getFullYear() !== currentDate.getFullYear()
          ) {
              return total;
          }
  
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
  
  }, [trades, currentDate]);

  const weeklyData = useMemo(() => {

    const weeks = {
        1: { pnl: 0, trades: 0, wins: 0 },
        2: { pnl: 0, trades: 0, wins: 0 },
        3: { pnl: 0, trades: 0, wins: 0 },
        4: { pnl: 0, trades: 0, wins: 0 },
        5: { pnl: 0, trades: 0, wins: 0 },
    };

    trades.forEach((trade) => {

        const tradeDate = new Date(trade.date);

        if (
            tradeDate.getMonth() !== currentDate.getMonth() ||
            tradeDate.getFullYear() !== currentDate.getFullYear()
        ) {
            return;
        }

        const day = tradeDate.getDate();

        const week = Math.ceil(day / 7);

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

}, [trades, currentDate]);

  return (

    <div
className="
relative
overflow-hidden
bg-white
rounded-3xl
border
border-gray-200
"
>

      {/* Header */}

      <div
  className="
  flex
  items-center
  justify-between
  px-7
  py-1
  border-b
  border-gray-200
  "
>

  {/* Left */}

  <div>

    <h2 className="text-2xl font-bold text-gray-900">

      Monthly Journal

    </h2>

   

  </div>

  {/* Right */}

  <div className="flex items-center gap-4">

    {/* Monthly Net */}

    <div
      className="
      bg-violet-50
      border
      border-violet-200
      rounded-2xl
      px-5
      py-2
      "
    >

      <p className="text-xs text-gray-500">

        Monthly Net P&L

      </p>

      <h3
    className={`text-lg font-bold ${
        monthlyPnL >= 0
            ? "text-green-600"
            : "text-red-600"
    }`}
>
    {monthlyPnL >= 0 ? "+" : "-"}$

    {Math.abs(monthlyPnL).toLocaleString()}

</h3>

    </div>

    {/* Navigation */}

    <div className="flex items-center gap-2">

      <button
        onClick={previousMonth}
        className="
        w-10
        h-10
        rounded-xl
        border
        border-gray-200
        hover:border-violet-300
        hover:bg-violet-50
        transition
        "
      >
        <ChevronLeft
          size={18}
          className="mx-auto"
        />
      </button>

      <button
        onClick={goToday}
        className="
        px-5
        py-2
        rounded-xl
        bg-violet-600
        text-white
        font-medium
        hover:bg-violet-700
        transition
        "
      >
        {monthName} {year}
      </button>

      <button
        onClick={nextMonth}
        className="
        w-10
        h-10
        rounded-xl
        border
        border-gray-200
        hover:border-violet-300
        hover:bg-violet-50
        transition
        "
      >
        <ChevronRight
          size={18}
          className="mx-auto"
        />
      </button>

    </div>

  </div>

</div>

      {/* Week Names */}

      <div
        className="
        grid
        grid-cols-7
        border-b
        border-gray-200
        "
      >

        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day)=>(
          <div
            key={day}
            className="
            py-4
            text-center
            text-xs
            font-semibold
            uppercase
            tracking-wider
            text-gray-500
            "
          >
            {day}
          </div>
        ))}

      </div>

      {/* Calendar */}

      <div className="grid grid-cols-7">

      {calendarDays.map((day,index)=>(

<CalendarDay

  key={index}

  index={index}

  day={day}

  currentDate={currentDate}

  tradeMap={tradeMap}

  onClick={(date) => navigate(`/tradelog?date=${date}`)}

/>

))}

<DailyJournalModal
    trade={selectedTrade}
    onClose={() => setSelectedTrade(null)}
/>

      </div>

    </div>

  );

}