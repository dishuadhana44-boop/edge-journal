import useWeeklyReview from "../../../hooks/useWeeklyReview";
import {
  TrendingUp,
  Target,
  DollarSign,
  Award
} from "lucide-react";

export default function WeeklyStats() {

  const review = useWeeklyReview();

  const stats = [

    {
      title: "Trades",
      value: review.trades,
      icon: TrendingUp,
    },

    {
      title: "Win Rate",
      value: `${review.winRate}%`,
      icon: Award,
    },

    {
      title: "Net P&L",
      value: review.pnl,
      icon: DollarSign,
    },

    {
      title: "Average RR",
      value: review.rr,
      icon: Target,
    },

  ];

  return (

    <div className="grid grid-cols-4 gap-6">

      {stats.map((item, index) => {

        const Icon = item.icon;

        return (

          <div
            key={index}
            className="group bg-white rounded-3xl border border-gray-200 p-6 hover:border-purple-500 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(124,58,237,.18)] transition-all duration-500"
          >

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center group-hover:scale-110 transition">

              <Icon className="text-white" />

            </div>

            <p className="text-gray-400 text-sm mt-6">

              {item.title}

            </p>

            <h2 className="text-4xl font-bold mt-2">

              {item.value}

            </h2>

          </div>

        );

      })}

    </div>

  );

}