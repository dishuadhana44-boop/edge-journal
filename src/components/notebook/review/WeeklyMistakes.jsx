import { useState } from "react";

const violations = [
  "Entered Early",
  "Ignored Stop Loss",
  "Moved Stop Loss",
  "Overtraded",
  "Revenge Trade",
  "FOMO Entry",
  "Position Too Large",
  "No Confirmation",
];

export default function WeeklyMistakes() {

  const [selected, setSelected] = useState([]);

  const [wins, setWins] = useState("");

  const [mistakes, setMistakes] = useState("");

  function toggle(item) {

    if (selected.includes(item)) {

      setSelected(selected.filter(i => i !== item));

    } else {

      setSelected([...selected, item]);

    }

  }

  return (

    <div className="bg-white rounded-3xl border border-gray-200 p-8 hover:shadow-xl transition-all duration-500">

      <h2 className="text-2xl font-bold">

        Weekly Reflection

      </h2>

      <p className="text-gray-500 mt-2">

        Analyse your biggest wins and recurring mistakes.

      </p>

      {/* Rule Violations */}

      <div className="mt-8">

        <h3 className="font-semibold text-lg mb-4">

          Rule Violations

        </h3>

        <div className="flex flex-wrap gap-3">

          {violations.map((item) => {

            const active = selected.includes(item);

            return (

              <button

                key={item}

                onClick={() => toggle(item)}

                className={`
                  px-5
                  py-3
                  rounded-full
                  border
                  transition-all
                  duration-300
                  hover:-translate-y-1

                  ${
                    active
                      ? "bg-red-500 border-red-500 text-white shadow-lg"
                      : "bg-white border-gray-200 hover:border-red-400"
                  }
                `}
              >

                {item}

              </button>

            );

          })}

        </div>

      </div>

      {/* Wins & Mistakes */}

      <div className="grid grid-cols-2 gap-6 mt-10">

        {/* Wins */}

        <div className="rounded-3xl bg-green-50 border border-green-200 p-6">

          <h3 className="text-xl font-bold text-green-700">

            Biggest Wins

          </h3>

          <textarea

            rows={8}

            value={wins}

            onChange={(e)=>setWins(e.target.value)}

            placeholder="What did you do well this week?"

            className="
            mt-5
            w-full
            rounded-2xl
            border
            border-green-200
            bg-white
            p-4
            resize-none
            outline-none
            focus:ring-2
            focus:ring-green-400
            "

          />

        </div>

        {/* Mistakes */}

        <div className="rounded-3xl bg-red-50 border border-red-200 p-6">

          <h3 className="text-xl font-bold text-red-700">

            Biggest Mistakes

          </h3>

          <textarea

            rows={8}

            value={mistakes}

            onChange={(e)=>setMistakes(e.target.value)}

            placeholder="What mistakes repeated this week?"

            className="
            mt-5
            w-full
            rounded-2xl
            border
            border-red-200
            bg-white
            p-4
            resize-none
            outline-none
            focus:ring-2
            focus:ring-red-400
            "

          />

        </div>

      </div>

    </div>

  );

}