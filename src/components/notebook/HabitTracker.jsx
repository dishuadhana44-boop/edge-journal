import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Plus,
  Trash2,
} from "lucide-react";

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getStorageKey(accountId) {
  const normalizedAccountId =
    accountId !== undefined &&
    accountId !== null &&
    String(accountId).trim() !== ""
      ? String(accountId).trim()
      : "no-account";

  return `edgeflo-habit-tracker-${normalizedAccountId}`;
}

function createHabit(name = "") {
  return {
    id: `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    name,
    completedDates: [],
    createdAt: new Date().toISOString(),
  };
}

export default function HabitTracker({ onBack }) {
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

  const today = useMemo(
    () => getDateKey(),
    []
  );

  const [habits, setHabits] = useState([]);
  const [newHabit, setNewHabit] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(storageKey);

      if (!raw) {
        setHabits([]);
        return;
      }

      const parsed = JSON.parse(raw);

      if (
        parsed &&
        Array.isArray(parsed.habits)
      ) {
        setHabits(parsed.habits);
      } else {
        setHabits([]);
      }
    } catch (error) {
      console.error(
        "Failed to load habits:",
        error
      );

      setHabits([]);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      const data = {
        accountId,
        habits,
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
        "Failed to save habits:",
        error
      );
    }
  }, [
    accountId,
    habits,
    storageKey,
  ]);

  const addHabit = () => {
    const name = newHabit.trim();

    if (!name) return;

    setHabits((currentHabits) => [
      ...currentHabits,
      createHabit(name),
    ]);

    setNewHabit("");
  };

  const toggleHabit = (habitId) => {
    setHabits((currentHabits) =>
      currentHabits.map((habit) => {
        if (habit.id !== habitId) {
          return habit;
        }

        const completedDates =
          Array.isArray(
            habit.completedDates
          )
            ? habit.completedDates
            : [];

        const alreadyCompleted =
          completedDates.includes(today);

        return {
          ...habit,
          completedDates:
            alreadyCompleted
              ? completedDates.filter(
                  (date) => date !== today
                )
              : [
                  ...completedDates,
                  today,
                ],
        };
      })
    );
  };

  const deleteHabit = (habitId) => {
    setHabits((currentHabits) =>
      currentHabits.filter(
        (habit) => habit.id !== habitId
      )
    );
  };

  const getStreak = (habit) => {
    const completedDates = new Set(
      Array.isArray(habit.completedDates)
        ? habit.completedDates
        : []
    );

    let streak = 0;
    const date = new Date();

    while (
      completedDates.has(
        getDateKey(date)
      )
    ) {
      streak += 1;
      date.setDate(
        date.getDate() - 1
      );
    }

    return streak;
  };

  const completedToday = habits.filter(
    (habit) =>
      Array.isArray(
        habit.completedDates
      ) &&
      habit.completedDates.includes(today)
  ).length;

  const progress =
    habits.length > 0
      ? Math.round(
          (completedToday /
            habits.length) *
            100
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
                Habit Tracker
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Build consistency by tracking your daily habits.
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
              Today's Progress
            </p>

            <p className="mt-1 text-2xl font-bold text-gray-900">
              {progress}%
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-500">
              {completedToday} of{" "}
              {habits.length} completed
            </p>

            <p className="mt-1 text-xs text-gray-400">
              {today}
            </p>
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
          Add Habit
        </p>

        <div className="flex gap-3">
          <input
            type="text"
            value={newHabit}
            onChange={(event) =>
              setNewHabit(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                addHabit();
              }
            }}
            placeholder="e.g. Read 30 minutes"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          />

          <button
            onClick={addHabit}
            className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
          >
            <Plus size={18} />
            Add
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {habits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="font-semibold text-gray-700">
              No habits yet
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Add your first habit to start building consistency.
            </p>
          </div>
        ) : (
          habits.map((habit, index) => {
            const completed =
              Array.isArray(
                habit.completedDates
              ) &&
              habit.completedDates.includes(
                today
              );

            const streak =
              getStreak(habit);

            return (
              <div
                key={habit.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
                  completed
                    ? "border-green-200 bg-green-50/40"
                    : "border-gray-200 hover:border-purple-300 hover:shadow-md"
                }`}
              >
                <div className="flex items-center gap-4">
                  <button
                    onClick={() =>
                      toggleHabit(habit.id)
                    }
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                      completed
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-gray-300 bg-white text-transparent hover:border-purple-400"
                    }`}
                  >
                    <Check size={19} />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-400">
                        {String(
                          index + 1
                        ).padStart(2, "0")}
                      </span>

                      <h3
                        className={`font-semibold ${
                          completed
                            ? "text-green-700 line-through"
                            : "text-gray-900"
                        }`}
                      >
                        {habit.name}
                      </h3>
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                      <span>
                        🔥 {streak} day
                        {streak === 1
                          ? ""
                          : "s"} streak
                      </span>

                      <span>
                        {
                          habit
                            .completedDates
                            ?.length || 0
                        }{" "}
                        total days
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      deleteHabit(
                        habit.id
                      )
                    }
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                    title="Delete habit"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {habits.length > 0 &&
        progress === 100 && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
            <div className="text-lg font-bold text-green-700">
              All habits completed today! 🔥
            </div>

            <p className="mt-1 text-sm text-green-600">
              Great consistency. Keep the streak alive.
            </p>
          </div>
        )}
    </div>
  );
}