import { useState, useMemo } from "react";
import {
  ShieldCheck,
  Brain,
  Target,
  TrendingUp,
} from "lucide-react";

export default function WeeklyScore() {

  const [discipline, setDiscipline] = useState(8);

  const [execution, setExecution] = useState(7);

  const [psychology, setPsychology] = useState(8);

  const [risk, setRisk] = useState(9);

  const overall = useMemo(() => {

    return Math.round(

      (discipline + execution + psychology + risk) / 4

    );

  }, [

    discipline,

    execution,

    psychology,

    risk,

  ]);

  const radius = 72;

  const circumference =

    2 * Math.PI * radius;

  const offset =

    circumference -

    (overall / 10) * circumference;

  function ScoreCard({

    title,

    value,

    setValue,

    icon: Icon,

  }) {

    return (

      <div className="rounded-2xl border border-gray-200 p-5 hover:border-purple-500 hover:shadow-lg transition-all">

        <div className="flex items-center justify-between">

          <div>

            <p className="text-sm text-gray-500">

              {title}

            </p>

            <h3 className="text-3xl font-bold mt-1">

              {value}

            </h3>

          </div>

          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">

            <Icon className="text-purple-600"/>

          </div>

        </div>

        <input

          type="range"

          min={1}

          max={10}

          value={value}

          onChange={(e)=>

            setValue(Number(e.target.value))

          }

          className="w-full mt-6 accent-purple-600"

        />

      </div>

    );

  }

  return (

    <div className="bg-white rounded-3xl border border-gray-200 p-8 hover:shadow-xl transition-all duration-500">

      <h2 className="text-2xl font-bold">

        Weekly Score

      </h2>

      <p className="text-gray-500 mt-2">

        Evaluate your trading discipline.

      </p>

      {/* Circle */}

      <div className="flex justify-center mt-10">

        <div className="relative w-44 h-44">

          <svg

            className="-rotate-90"

            width="176"

            height="176"

          >

            <circle

              cx="88"

              cy="88"

              r={radius}

              stroke="#ececec"

              strokeWidth="12"

              fill="none"

            />

            <circle

              cx="88"

              cy="88"

              r={radius}

              stroke="#7C3AED"

              strokeWidth="12"

              fill="none"

              strokeLinecap="round"

              strokeDasharray={circumference}

              strokeDashoffset={offset}

              style={{

                transition:"all .8s"

              }}

            />

          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">

            <h1 className="text-5xl font-bold">

              {overall}

            </h1>

            <p className="text-gray-500">

              Overall

            </p>

          </div>

        </div>

      </div>

      {/* Scores */}

      <div className="space-y-5 mt-10">

        <ScoreCard

          title="Discipline"

          value={discipline}

          setValue={setDiscipline}

          icon={ShieldCheck}

        />

        <ScoreCard

          title="Execution"

          value={execution}

          setValue={setExecution}

          icon={Target}

        />

        <ScoreCard

          title="Psychology"

          value={psychology}

          setValue={setPsychology}

          icon={Brain}

        />

        <ScoreCard

          title="Risk Management"

          value={risk}

          setValue={setRisk}

          icon={TrendingUp}

        />

      </div>

    </div>

  );

}