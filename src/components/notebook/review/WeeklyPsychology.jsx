import { useState } from "react";

const emotions = [
  "😌 Patient",
  "😨 Fear",
  "😡 Revenge",
  "🔥 FOMO",
  "😤 Overtrading",
  "😎 Confident",
  "🧘 Calm",
  "🎯 Disciplined",
];

export default function WeeklyPsychology() {

  const [selected, setSelected] = useState([]);
  const [notes, setNotes] = useState("");

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

        Psychology Review

      </h2>

      <p className="text-gray-500 mt-2">

        Which emotions affected your trading this week?

      </p>

      {/* Emotion Chips */}

      <div className="grid grid-cols-2 gap-4 mt-8">

        {emotions.map((item) => {

          const active = selected.includes(item);

          return (

            <button

              key={item}

              onClick={() => toggle(item)}

              className={`
                rounded-2xl
                border
                p-5
                text-left
                transition-all
                duration-300
                hover:-translate-y-1
                hover:shadow-lg

                ${
                  active
                    ? "bg-purple-600 text-white border-purple-600 scale-105 shadow-xl"
                    : "bg-white border-gray-200 hover:border-purple-400"
                }
              `}
            >

              <span className="font-semibold text-lg">

                {item}

              </span>

            </button>

          );

        })}

      </div>

      {/* Notes */}

      <div className="mt-8">

        <label className="block text-sm font-semibold mb-3">

          Psychology Notes

        </label>

        <textarea

          rows={6}

          value={notes}

          onChange={(e)=>setNotes(e.target.value)}

          placeholder="Write about your emotions, discipline and mindset..."

          className="
          w-full
          rounded-2xl
          border
          border-gray-300
          p-5
          resize-none
          outline-none
          focus:ring-2
          focus:ring-purple-500
          transition
          "

        />

      </div>

    </div>

  );

}