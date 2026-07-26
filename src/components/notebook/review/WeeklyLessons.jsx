import { Lightbulb, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export default function WeeklyLessons() {

  const [lessons, setLessons] = useState([
    ""
  ]);

  function updateLesson(index, value) {

    const copy = [...lessons];

    copy[index] = value;

    setLessons(copy);

  }

  function addLesson() {

    setLessons([...lessons, ""]);

  }

  function removeLesson(index) {

    setLessons(

      lessons.filter((_, i) => i !== index)

    );

  }

  return (

    <div className="bg-white rounded-3xl border border-gray-200 p-8 hover:shadow-lg transition-all">

      {/* Header */}

      <div className="flex items-center justify-between">

        <div className="flex items-center gap-3">

          <div className="w-12 h-12 rounded-2xl bg-yellow-100 flex items-center justify-center">

            <Lightbulb
              className="text-yellow-500"
              size={22}
            />

          </div>

          <div>

            <h2 className="text-2xl font-bold">

              Lessons Learned

            </h2>

            <p className="text-gray-500 mt-1">

              What did this week teach you?

            </p>

          </div>

        </div>

        <button

          onClick={addLesson}

          className="w-10 h-10 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center transition"

        >

          <Plus size={18} />

        </button>

      </div>

      {/* List */}

      <div className="space-y-4 mt-8">

        {lessons.map((lesson, index) => (

          <div

            key={index}

            className="flex gap-3"

          >

            <textarea

              value={lesson}

              onChange={(e) =>
                updateLesson(index, e.target.value)
              }

              placeholder="Example: I should only trade after market structure confirmation..."

              className="flex-1 min-h-[90px] rounded-2xl border border-gray-200 p-4 resize-none outline-none focus:border-purple-500"

            />

            <button

              onClick={() => removeLesson(index)}

              className="w-11 h-11 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"

            >

              <Trash2 size={18} />

            </button>

          </div>

        ))}

      </div>

    </div>

  );

}