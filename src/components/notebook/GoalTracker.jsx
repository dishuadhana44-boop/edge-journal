import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Plus,
  Trash2,
} from "lucide-react";

function getStorageKey(accountId) {
  const normalizedAccountId =
    accountId !== undefined &&
    accountId !== null &&
    String(accountId).trim() !== ""
      ? String(accountId).trim()
      : "no-account";

  return `edgeflo-goal-tracker-${normalizedAccountId}`;
}

function createGoal(title = "", targetDate = "") {
  return {
    id: `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    title,
    targetDate,
    progress: 0,
    completed: false,
    createdAt: new Date().toISOString(),
  };
}

export default function GoalTracker({ onBack }) {
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

  const storageKey = useMemo(
    () => getStorageKey(accountId),
    [accountId]
  );

  const [goals, setGoals] = useState([]);
  const [newGoal, setNewGoal] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(storageKey);

      if (!raw) {
        setGoals([]);
        return;
      }

      const parsed = JSON.parse(raw);

      if (
        parsed &&
        Array.isArray(parsed.goals)
      ) {
        setGoals(parsed.goals);
      } else {
        setGoals([]);
      }
    } catch (error) {
      console.error(
        "Failed to load goals:",
        error
      );

      setGoals([]);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      const data = {
        accountId,
        goals,
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
        "Failed to save goals:",
        error
      );
    }
  }, [
    accountId,
    goals,
    storageKey,
  ]);

  const addGoal = () => {
    const title = newGoal.trim();

    if (!title) return;

    setGoals((currentGoals) => [
      ...currentGoals,
      createGoal(title, targetDate),
    ]);

    setNewGoal("");
    setTargetDate("");
  };

  const updateProgress = (goalId, value) => {
    const progress = Math.max(
      0,
      Math.min(100, Number(value) || 0)
    );

    setGoals((currentGoals) =>
      currentGoals.map((goal) =>
        goal.id === goalId
          ? {
              ...goal,
              progress,
              completed: progress === 100,
            }
          : goal
      )
    );
  };

  const toggleComplete = (goalId) => {
    setGoals((currentGoals) =>
      currentGoals.map((goal) =>
        goal.id === goalId
          ? {
              ...goal,
              completed: !goal.completed,
              progress: !goal.completed
                ? 100
                : goal.progress === 100
                ? 0
                : goal.progress,
            }
          : goal
      )
    );
  };

  const deleteGoal = (goalId) => {
    setGoals((currentGoals) =>
      currentGoals.filter(
        (goal) => goal.id !== goalId
      )
    );
  };

  const completedGoals = goals.filter(
    (goal) => goal.completed
  ).length;

  const overallProgress =
    goals.length > 0
      ? Math.round(
          goals.reduce(
            (total, goal) =>
              total + Number(goal.progress || 0),
            0
          ) / goals.length
        )
      : 0;

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
                Goal Tracker
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Set meaningful goals and track your progress.
              </p>
            </div>
          </div>

          {saved && (
            <span className="text-xs font-medium text-green-600">
              Saved
            </span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">
              Overall Progress
            </p>

            <p className="mt-1 text-2xl font-bold text-gray-900">
              {overallProgress}%
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-500">
              {completedGoals} of{" "}
              {goals.length} goals completed
            </p>
          </div>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-purple-600 transition-all duration-300"
            style={{
              width: `${overallProgress}%`,
            }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-gray-700">
          Create Goal
        </p>

        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={newGoal}
            onChange={(event) =>
              setNewGoal(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                addGoal();
              }
            }}
            placeholder="What do you want to achieve?"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          />

          <input
            type="date"
            value={targetDate}
            onChange={(event) =>
              setTargetDate(event.target.value)
            }
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          />

          <button
            onClick={addGoal}
            className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
          >
            <Plus size={18} />
            Add Goal
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {goals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="font-semibold text-gray-700">
              No goals yet
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Create your first goal to start tracking progress.
            </p>
          </div>
        ) : (
          goals.map((goal, index) => (
            <div
              key={goal.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
                goal.completed
                  ? "border-green-200 bg-green-50/40"
                  : "border-gray-200 hover:border-purple-300 hover:shadow-md"
              }`}
            >
              <div className="flex items-start gap-4">
                <button
                  onClick={() =>
                    toggleComplete(goal.id)
                  }
                  className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                    goal.completed
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-gray-300 bg-white text-transparent hover:border-purple-400"
                  }`}
                >
                  <Check size={19} />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-400">
                          {String(index + 1).padStart(
                            2,
                            "0"
                          )}
                        </span>

                        <h3
                          className={`font-semibold ${
                            goal.completed
                              ? "text-green-700 line-through"
                              : "text-gray-900"
                          }`}
                        >
                          {goal.title}
                        </h3>
                      </div>

                      {goal.targetDate && (
                        <p className="mt-1 text-xs text-gray-500">
                          Target: {goal.targetDate}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() =>
                        deleteGoal(goal.id)
                      }
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Delete goal"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">
                        Progress
                      </span>

                      <span className="text-sm font-bold text-purple-600">
                        {goal.progress}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={goal.progress}
                      onChange={(event) =>
                        updateProgress(
                          goal.id,
                          event.target.value
                        )
                      }
                      className="w-full accent-purple-600"
                    />

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-purple-600 transition-all duration-300"
                        style={{
                          width: `${goal.progress}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {goals.length > 0 &&
        overallProgress === 100 && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
            <div className="text-lg font-bold text-green-700">
              All goals completed! 🎯
            </div>

            <p className="mt-1 text-sm text-green-600">
              Excellent work. Keep setting bigger goals.
            </p>
          </div>
        )}
    </div>
  );
}