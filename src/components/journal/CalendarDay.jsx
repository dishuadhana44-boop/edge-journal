import { useState } from "react";
import CalendarTooltip from "./CalendarTooltip";

export default function CalendarDay({
    day, 
    index,
    currentDate,
    tradeMap,
    onClick,

    }){

    const [hover, setHover] = useState(false);

    const today = new Date();

const isToday =
  day &&
  today.getDate() === day &&
  today.getMonth() === currentDate.getMonth() &&
  today.getFullYear() === currentDate.getFullYear();
  
    
  const dateKey = day
  ? `${currentDate.getFullYear()}-${String(
      currentDate.getMonth() + 1
    ).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  : "";

const trade = tradeMap?.[dateKey];
  
    return (
  
      <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => trade && onClick(dateKey)}
      className="
      relative
      overflow-visible
      h-26
      border
      border-gray-200
      transition-all
      duration-200
      hover:border-violet-400
      hover:shadow-md
      bg-white
      p-3
      cursor-pointer
      "
      >
  
        {/* Day */}
  
        {day && (
  
          <div className="flex justify-between">
  
            <span
              className="
              text-sm
              font-semibold
              text-gray-700
              "
            >
              {day}
            </span>
  
            {isToday && (
  
              <span
                className="
                text-[10px]
                px-2
                py-1
                rounded-full
                bg-violet-600
                text-white
                "
              >
                Today
              </span>
  
            )}
  
          </div>
  
        )}
  
        {/* Trade */}
  
        {trade && (

<>
    {/* Small Trade Card */}

    <div className="absolute bottom-2 left-2 right-2">

        <p className="text-xs text-gray-500">
            {trade.trades} Trades
        </p>

        <h3
            className={`font-bold mt-1 ${
                trade.pnl >= 0
                    ? "text-green-600"
                    : "text-red-600"
            }`}
        >
            {trade.pnl > 0 ? "+" : "-"}$
            {trade.pnl.toLocaleString()}
        </h3>

    </div>

    {/* Tooltip */}

    {hover && (

<CalendarTooltip
index={index}
trade={{
    ...trade,
    date: dateKey,
}}
/>

    )}

</>

)}
  
      </div>
  
    );
  
  }