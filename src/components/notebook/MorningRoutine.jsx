import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";

const DEFAULT_TASKS = [
  {
    id: "wake-up",
    title: "Wake Up",
    description: "Start the day on time.",
  },
  {
    id: "water",
    title: "Drink Water",
    description: "Hydrate before starting the day.",
  },
  {
    id: "meditation",
    title: "Meditation",
    description: "Take a few minutes to clear your mind.",
  },
  {
    id: "exercise",
    title: "Exercise",
    description: "Move your body and build energy.",
  },
  {
    id: "reading",
    title: "Reading",
    description: "Read something useful for your growth.",
  },
  {
    id: "trading-plan",
    title: "Trading Plan",
    description: "Review your market plan, bias and key levels.",
  },
  {
    id: "market-preparation",
    title: "Market Preparation",
    description: "Check economic events and potential setups.",
  },
];

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

  return `edgeflo-morning-routine-${normalizedAccountId}-${dateKey}`;
}

function createInitialTasks() {
  return DEFAULT_TASKS.map((task) => ({
    ...task,
    completed: false,
  }));
}

export default function MorningRoutine({
  onBack,
}) {
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

  const [tasks, setTasks] = useState(() =>
    createInitialTasks()
  );

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(storageKey);

      if (!raw) {
        setTasks(createInitialTasks());
        return;
      }

      const parsed = JSON.parse(raw);

      if (
        parsed &&
        Array.isArray(parsed.tasks)
      ) {
        setTasks(parsed.tasks);
      } else {
        setTasks(createInitialTasks());
      }
    } catch (error) {
      console.error(
        "Failed to load morning routine:",
        error
      );

      setTasks(createInitialTasks());
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
        "Failed to save morning routine:",
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

  const resetRoutine = () => {
    setTasks(createInitialTasks());
  };

  return (
    <div className="space-y-5">
      {/* Header */}
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
                Morning Routine
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Start your day with intention and consistency.
              </p>
            </div>
          </div>

          <button
            onClick={resetRoutine}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      </div>

      {/* Progress */}
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

      {/* Routine Tasks */}
      <div className="space-y-3">
        {tasks.map((task, index) => (
          <button
            key={task.id}
            onClick={() =>
              toggleTask(task.id)
            }
            className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
              task.completed
                ? "border-green-200 bg-green-50/40"
                : "border-gray-200 hover:border-purple-300 hover:shadow-md"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                  task.completed
                    ? "border-green-500 bg-green-500 text-white"
                    : "border-gray-300 bg-white text-transparent"
                }`}
              >
                <Check size={19} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-400">
                    {String(index + 1).padStart(
                      2,
                      "0"
                    )}
                  </span>

                  <h3
                    className={`font-semibold ${
                      task.completed
                        ? "text-green-700 line-through"
                        : "text-gray-900"
                    }`}
                  >
                    {task.title}
                  </h3>
                </div>

                <p className="mt-1 text-sm text-gray-500">
                  {task.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Completion Message */}
      {progress === 100 && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
          <div className="text-lg font-bold text-green-700">
            Morning routine completed! 🎯
          </div>

          <p className="mt-1 text-sm text-green-600">
            Great start. Now execute your day with discipline.
          </p>
        </div>
      )}
    </div>
  );
}