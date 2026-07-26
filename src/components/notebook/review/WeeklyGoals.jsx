import { useState } from "react";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";

export default function WeeklyGoals() {

  const [input, setInput] = useState("");

  const [goals, setGoals] = useState([]);

  function addGoal() {

    if (!input.trim()) return;

    setGoals([
      ...goals,
      {
        id: Date.now(),
        text: input,
        completed: false,
      },
    ]);

    setInput("");
  }

  function toggleGoal(id) {

    setGoals(

      goals.map((goal) =>
        goal.id === id
          ? {
              ...goal,
              completed: !goal.completed,
            }
          : goal
      )

    );

  }

  function deleteGoal(id) {

    setGoals(

      goals.filter((goal) => goal.id !== id)

    );

  }

  const completed = goals.filter(g => g.completed).length;

  const progress =
    goals.length === 0
      ? 0
      : Math.round((completed / goals.length) * 100);

  return (

    <div className="bg-white rounded-3xl border border-gray-200 p-8 hover:shadow-xl transition-all duration-500">

      <div className="flex items-center justify-between">

        <div>

          <h2 className="text-2xl font-bold">

            Weekly Goals

          </h2>

          <p className="text-gray-500 mt-1">

            Track your objectives for this week.

          </p>

        </div>

        <button

          onClick={addGoal}

          className="w-11 h-11 rounded-2xl bg-purple-600 hover:bg-purple-700 flex items-center justify-center text-white transition"

        >

          <Plus size={20} />

        </button>

      </div>

      {/* Progress */}

      <div className="mt-8">

        <div className="flex justify-between mb-2">

          <span className="text-sm text-gray-500">

            Progress

          </span>

          <span className="text-sm font-semibold">

            {progress}%

          </span>

        </div>

        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">

          <div

            className="h-full bg-gradient-to-r from-purple-600 to-violet-500 transition-all duration-700"

            style={{

              width: `${progress}%`

            }}

          />

        </div>

      </div>

      {/* Add */}

      <div className="flex gap-3 mt-8">

        <input

          value={input}

          onChange={(e)=>setInput(e.target.value)}

          onKeyDown={(e)=>{

            if(e.key==="Enter"){

              addGoal();

            }

          }}

          placeholder="Add Weekly Goal..."

          className="flex-1 h-12 rounded-2xl border border-gray-300 px-4 outline-none focus:ring-2 focus:ring-purple-500"

        />

      </div>

      {/* List */}

      <div className="space-y-3 mt-8">

        {goals.map((goal)=>(

          <div

            key={goal.id}

            className="group flex items-center gap-4 rounded-2xl border border-gray-200 p-4 hover:border-purple-500 hover:bg-purple-50 transition"

          >

            <button

              onClick={()=>toggleGoal(goal.id)}

            >

              <CheckCircle2

                size={24}

                className={goal.completed
                  ? "text-green-500"
                  : "text-gray-300"}

              />

            </button>

            <p

              className={`flex-1 ${
                goal.completed
                  ? "line-through text-gray-400"
                  : "text-gray-700"
              }`}

            >

              {goal.text}

            </p>

            <button

              onClick={()=>deleteGoal(goal.id)}

            >

              <Trash2

                size={18}

                className="text-gray-400 hover:text-red-500"

              />

            </button>

          </div>

        ))}

      </div>

    </div>

  );

}