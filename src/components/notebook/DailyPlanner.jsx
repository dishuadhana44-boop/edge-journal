import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Plus,
  Trash2,
} from "lucide-react";

function getTodayKey() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getStorageKey(accountId, dateKey) {
  const normalizedAccountId =
    accountId !== undefined &&
    accountId !== null &&
    String(accountId).trim() !== ""
      ? String(accountId).trim()
      : "no-account";

  return `edgeflo-daily-planner-${normalizedAccountId}-${dateKey}`;
}

function createTask(title = "") {
  return {
    id: `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    title,
    completed: false,
  };
}

export default function DailyPlanner({ onBack }) {
  const [accountId] = useState(() => {
    try {
      const saved =
        localStorage.getItem("selectedAccountId");

      return saved ? String(saved).trim() : null;
    } catch (error) {
      console.error(
        "Failed to load selected account:",
        error
      );

      return null;
    }
  });

  const today = useMemo(
    () => getTodayKey(),
    []
  );

  const storageKey = useMemo(
    () => getStorageKey(accountId, today),
    [accountId, today]
  );

  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(storageKey);

      if (!raw) {
        setTasks([]);
        return;
      }

      const parsed = JSON.parse(raw);

      if (
        parsed &&
        Array.isArray(parsed.tasks)
      ) {
        setTasks(parsed.tasks);
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.error(
        "Failed to load daily planner:",
        error
      );

      setTasks([]);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      const data = {
        accountId,
        date: today,
        tasks,
        updatedAt:
          new Date().toISOString(),
      };

      localStorage.setItem(
        storageKey,
        JSON.stringify(data)
      );

      setSaved(true);

      const timer = setTimeout(() => {
        setSaved(false);
      }, 1200);

      return () => clearTimeout(timer);
    } catch (error) {
      console.error(
        "Failed to save daily planner:",
        error
      );
    }
  }, [
    accountId,
    today,
    tasks,
    storageKey,
  ]);

  const completedCount = tasks.filter(
    (task) => task.completed
  ).length;

  const progress =
    tasks.length > 0
      ? Math.round(
          (completedCount / tasks.length) *
            100
        )
      : 0;

  const addTask = () => {
    const title = newTask.trim();

    if (!title) return;

    setTasks((currentTasks) => [
      ...currentTasks,
      createTask(title),
    ]);

    setNewTask("");
  };

  const toggleTask = (taskId) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed:
                !task.completed,
            }
          : task
      )
    );
  };

  const deleteTask = (taskId) => {
    setTasks((currentTasks) =>
      currentTasks.filter(
        (task) => task.id !== taskId
      )
    );
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      addTask();
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-600"
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Daily Planner
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Plan your priorities and execute your day.
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm font-medium text-gray-500">
              Today
            </p>

            <p className="text-sm font-semibold text-gray-900">
              {today}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">
              Today's Progress
            </p>

            <p className="mt-1 text-2xl font-bold text-gray-900">
              {progress}%
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-500">
              {completedCount} of{" "}
              {tasks.length} completed
            </p>

            {saved && (
              <p className="mt-1 text-xs text-green-600">
                Saved
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-purple-600 transition-all duration-300"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-gray-700">
          Add Task
        </p>

        <div className="flex gap-3">
          <input
            type="text"
            value={newTask}
            onChange={(event) =>
              setNewTask(event.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder="What do you need to accomplish today?"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          />

          <button
            onClick={addTask}
            className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
          >
            <Plus size={18} />
            Add
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="font-semibold text-gray-700">
              No tasks yet
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Add your first task to start planning today.
            </p>
          </div>
        ) : (
          tasks.map((task, index) => (
            <div
              key={task.id}
              className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
                task.completed
                  ? "border-green-200 bg-green-50/40"
                  : "border-gray-200 hover:border-purple-300 hover:shadow-md"
              }`}
            >
              <div className="flex items-center gap-4">
                <button
                  onClick={() =>
                    toggleTask(task.id)
                  }
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                    task.completed
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-gray-300 bg-white text-transparent hover:border-purple-400"
                  }`}
                >
                  <Check size={19} />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400">
                      {String(index + 1).padStart(
                        2,
                        "0"
                      )}
                    </span>

                    <p
                      className={`font-semibold ${
                        task.completed
                          ? "text-green-700 line-through"
                          : "text-gray-900"
                      }`}
                    >
                      {task.title}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() =>
                    deleteTask(task.id)
                  }
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                  title="Delete task"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {tasks.length > 0 &&
        progress === 100 && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
            <div className="text-lg font-bold text-green-700">
              All tasks completed! 🎯
            </div>

            <p className="mt-1 text-sm text-green-600">
              Excellent execution. You completed everything planned for today.
            </p>
          </div>
        )}
    </div>
  );
}