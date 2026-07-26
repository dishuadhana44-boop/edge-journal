import { useState } from "react";
import {
  Plus,
  Trash2,
  CheckCircle2,
  Flag,
} from "lucide-react";

export default function WeeklyActionPlan() {

  const [text, setText] = useState("");

  const [priority, setPriority] = useState("Medium");

  const [tasks, setTasks] = useState([]);

  function addTask() {

    if (!text.trim()) return;

    setTasks([
      ...tasks,
      {
        id: Date.now(),
        text,
        priority,
        completed: false,
      },
    ]);

    setText("");

  }

  function toggle(id) {

    setTasks(

      tasks.map(task =>
        task.id === id
          ? {
              ...task,
              completed: !task.completed,
            }
          : task
      )

    );

  }

  function remove(id) {

    setTasks(

      tasks.filter(task => task.id !== id)

    );

  }

  const completed = tasks.filter(t => t.completed).length;

  const progress =
    tasks.length === 0
      ? 0
      : Math.round((completed / tasks.length) * 100);

  function badgeColor(level){

    switch(level){

      case "High":

        return "bg-red-100 text-red-600";

      case "Medium":

        return "bg-yellow-100 text-yellow-700";

      default:

        return "bg-green-100 text-green-600";

    }

  }

  return (

    <div className="bg-white rounded-3xl border border-gray-200 p-8 hover:shadow-xl transition-all duration-500">

      <h2 className="text-2xl font-bold">

        Next Week Action Plan

      </h2>

      <p className="text-gray-500 mt-2">

        Focus on what matters next week.

      </p>

      {/* Progress */}

      <div className="mt-8">

        <div className="flex justify-between mb-2">

          <span className="text-sm text-gray-500">

            Completion

          </span>

          <span className="font-semibold">

            {progress}%

          </span>

        </div>

        <div className="h-3 rounded-full bg-gray-200 overflow-hidden">

          <div

            style={{

              width:`${progress}%`

            }}

            className="h-full bg-gradient-to-r from-purple-600 to-violet-500 transition-all duration-700"

          />

        </div>

      </div>

      {/* Add */}

      <div className="mt-8 space-y-4">

        <input

          value={text}

          onChange={(e)=>setText(e.target.value)}

          placeholder="New Action..."

          className="w-full h-12 rounded-2xl border border-gray-300 px-4 outline-none focus:ring-2 focus:ring-purple-500"

          onKeyDown={(e)=>{

            if(e.key==="Enter"){

              addTask();

            }

          }}

        />

        <div className="flex gap-3">

          <select

            value={priority}

            onChange={(e)=>setPriority(e.target.value)}

            className="flex-1 h-11 rounded-xl border border-gray-300 px-3"

          >

            <option>High</option>

            <option>Medium</option>

            <option>Low</option>

          </select>

          <button

            onClick={addTask}

            className="px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"

          >

            <Plus size={18}/>

            Add

          </button>

        </div>

      </div>

      {/* Tasks */}

      <div className="space-y-3 mt-8">

        {tasks.map(task=>(

          <div

            key={task.id}

            className="group rounded-2xl border border-gray-200 p-4 hover:border-purple-500 hover:bg-purple-50 transition-all"

          >

            <div className="flex items-center gap-4">

              <button

                onClick={()=>toggle(task.id)}

              >

                <CheckCircle2

                  size={24}

                  className={
                    task.completed
                      ? "text-green-500"
                      : "text-gray-300"
                  }

                />

              </button>

              <div className="flex-1">

                <p

                  className={`font-medium ${
                    task.completed
                      ? "line-through text-gray-400"
                      : ""
                  }`}

                >

                  {task.text}

                </p>

              </div>

              <span

                className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeColor(task.priority)}`}

              >

                <Flag size={12} className="inline mr-1"/>

                {task.priority}

              </span>

              <button

                onClick={()=>remove(task.id)}

              >

                <Trash2

                  size={18}

                  className="text-gray-400 hover:text-red-500"

                />

              </button>

            </div>

          </div>

        ))}

      </div>

    </div>

  );

}