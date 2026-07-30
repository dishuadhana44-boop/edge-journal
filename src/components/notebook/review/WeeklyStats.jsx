import {
  TrendingUp,
  Trophy,
  PoundSterling,
  Target,
} from "lucide-react";

const stats = [

  {
    title: "Trades",
    value: "18",
    icon: TrendingUp,
    color: "from-violet-500 to-purple-600",
  },

  {
    title: "Win Rate",
    value: "55%",
    icon: Trophy,
    color: "from-green-500 to-emerald-500",
  },

  {
    title: "Net P&L",
    value: "+£1,420",
    icon: PoundSterling,
    color: "from-cyan-500 to-blue-500",
  },

  {
    title: "Average RR",
    value: "2.6R",
    icon: Target,
    color: "from-orange-500 to-pink-500",
  },

];

export default function WeeklyStats() {

  return (

    <div className="grid grid-cols-4 gap-3">

      {stats.map((item, index) => {

        const Icon = item.icon;

        return (

          <div

            key={index}

            className="

            group

            relative

            overflow-hidden

            rounded-[28px]

            bg-white

            border

            border-gray-200

            hover:border-purple-500

            hover:-translate-y-2

            hover:shadow-[0_25px_60px_rgba(124,58,237,.18)]

            transition-all

            duration-500

            "

          >

            {/* Glow */}

            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-purple-100 opacity-0 group-hover:opacity-100 blur-3xl transition"/>

            <div className="relative p-7">

              <div

                className={`

                w-14

                h-14

                rounded-2xl

                bg-gradient-to-br

                ${item.color}

                flex

                items-center

                justify-center

                shadow-lg

                group-hover:scale-110

                transition

                duration-300

                `}

              >

                <Icon

                  size={25}

                  className="text-white"

                />

              </div>

              <p className="mt-7 text-gray-400 text-sm font-medium">

                {item.title}

              </p>

              <h2 className="mt-2 text-5xl font-black tracking-tight">

                {item.value}

              </h2>

              <div className="mt-5 h-2 rounded-full bg-gray-100 overflow-hidden">

                <div

                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-500 w-3/4"

                />

              </div>

            </div>

          </div>

        );

      })}

    </div>

  );

}