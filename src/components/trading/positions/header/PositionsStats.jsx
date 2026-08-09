import { useTrade } from "../../../../context/TradeContext";

export default function PositionsStats() {

  const {
    balance,
    floatingPnL,
    openTradesCount,
    marginUsed,
    winRate,
  } = useTrade();

  const cards = [
    {
      title: "Account Balance",
      value: `$${balance.toLocaleString()}`,
      color: "text-violet-600",
    },
    {
      title: "Floating P/L",
      value: `$${floatingPnL.toFixed(2)}`,
      color:
        floatingPnL >= 0
          ? "text-emerald-600"
          : "text-red-600",
    },
    {
      title: "Open Trades",
      value: openTradesCount,
      color: "text-black",
    },
    {
      title: "Margin Used",
      value: `$${marginUsed.toFixed(2)}`,
      color: "text-black",
    },
    {
      title: "Win Rate",
      value: `${winRate.toFixed(0)}%`,
      color: "text-black",
    },
  ];

  return (
    <div className="flex gap-3 px-5 py-5 border-b">

      {cards.map((card) => (
        <div
          key={card.title}
          className="
            flex-1
            min-w-[170px]
            max-w-[185px]
            rounded-xl
            border
            border-gray-200
            bg-gray-50
            p-4
          "
        >

          <p className="text-[11px] uppercase font-bold text-gray-600">
            {card.title}
          </p>

          <h2 className={`mt-2 text-2xl font-bold ${card.color}`}>
            {card.value}
          </h2>

        </div>
      ))}

    </div>
  );
}