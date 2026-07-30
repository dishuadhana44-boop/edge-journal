import { useState } from "react";
import {
  Plus,
  Trash2,
  Check,
  Target,
} from "lucide-react";

export default function WeeklyGoals() {

  const [text, setText] = useState("");

  const [goals, setGoals] = useState([]);

  function addGoal() {

    if (!text.trim()) return;

    setGoals([
      ...goals,
      {
        id: Date.now(),
        title: text,
        done: false,
      },
    ]);

    setText("");

  }

  function toggleGoal(id) {

    setGoals(

      goals.map((goal) =>

        goal.id === id

          ? {

              ...goal,

              done: !goal.done,

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

  const completed = goals.filter(

    (g) => g.done

  ).length;

  const percent =

    goals.length === 0

      ? 0

      : Math.round(

          (completed / goals.length) * 100

        );

  return (

    <div className="rounded-[30px] border border-gray-200 bg-white p-8">

      {/* Header */}

      <div className="flex justify-between items-center">

        <div>

          <h2 className="text-3xl font-black">

            Weekly Goals

          </h2>

          

        </div>

        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center shadow-lg">

          <Target className="text-white"/>

        </div>

      </div>

      {/* Progress */}

      <div className="mt-8">

        <div className="flex justify-between">

          <span className="font-medium">

            Progress

          </span>

          <span className="font-bold">

            {percent}%

          </span>

        </div>

        <div className="h-3 rounded-full bg-gray-100 mt-3 overflow-hidden">

          <div

            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-500 transition-all duration-700"

            style={{

              width: `${percent}%`,

            }}

          />

        </div>

      </div>

      {/* Add */}

      <div className="flex gap-3 mt-8">

        <input

          value={text}

          onChange={(e)=>setText(e.target.value)}

          placeholder="Add Weekly Goal..."

          className="flex-1 border rounded-2xl px-5 py-4 outline-none focus:border-purple-500"

        />

        <button

          onClick={addGoal}

          className="w-14 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center"

        >

          <Plus/>

        </button>

      </div>

      {/* Goals */}

      <div className="space-y-4 mt-8">

        {goals.map((goal)=>(

          <div

            key={goal.id}

            className="flex items-center justify-between border rounded-2xl p-4 hover:border-purple-500 transition"

          >

            <div

              className="flex items-center gap-4 cursor-pointer"

              onClick={()=>toggleGoal(goal.id)}

            >

              <div

                className={`

                w-7

                h-7

                rounded-full

                flex

                items-center

                justify-center

                transition

                ${goal.done

                  ? "bg-green-500"

                  : "border-2 border-gray-300"}

                `}

              >

                {goal.done &&

                  <Check

                    size={16}

                    className="text-white"

                  />

                }

              </div>

              <span

                className={`

                text-lg

                ${goal.done

                  ? "line-through text-gray-400"

                  : "font-medium"}

                `}

              >

                {goal.title}

              </span>

            </div>

            <button

              onClick={()=>deleteGoal(goal.id)}

              className="text-red-500"

            >

              <Trash2 size={18}/>

            </button>

          </div>

        ))}

      </div>

    </div>

  );

}