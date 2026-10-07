import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Target,
  Flame,
  ClipboardList,
  Sun,
} from "lucide-react";

const addNotebookActivity = ({
    type,
    title,
    description = "",
  }) => {
    try {
      const raw = localStorage.getItem(
        "edgeflo-notebook-activity"
      );
  
      const activities = raw
        ? JSON.parse(raw)
        : [];
  
      const newActivity = {
        id: `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        type,
        title,
        description,
        timestamp: new Date().toISOString(),
      };
  
      const updatedActivities = [
        newActivity,
        ...activities,
      ].slice(0, 50);
  
      localStorage.setItem(
        "edgeflo-notebook-activity",
        JSON.stringify(updatedActivities)
      );
    } catch (error) {
      console.error(
        "Failed to save notebook activity:",
        error
      );
    }
  };

const ACTIVITY_STORAGE_KEY =
  "edgeflo-notebook-activity";

const ICONS = {
  routine: Sun,
  planner: ClipboardList,
  goal: Target,
  habit: Flame,
  completed: CheckCircle2,
};

function getActivityIcon(type) {
  return ICONS[type] || Activity;
}

export default function NotebookActivity({ onBack }) {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        ACTIVITY_STORAGE_KEY
      );

      if (!saved) {
        setActivities([]);
        return;
      }

      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        setActivities(parsed);
      } else {
        setActivities([]);
      }
    } catch (error) {
      console.error(
        "Failed to load notebook activity:",
        error
      );

      setActivities([]);
    }
  }, []);

  const formatDate = (value) => {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-600"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Recent Activity
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Track your latest Notebook activity.
            </p>
          </div>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Activity
            size={32}
            className="mx-auto text-gray-300"
          />

          <h3 className="mt-4 font-semibold text-gray-700">
            No activity yet
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Your Notebook activity will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity, index) => {
            const Icon = getActivityIcon(
              activity.type
            );

            return (
              <div
                key={
                  activity.id ||
                  `${activity.timestamp}-${index}`
                }
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-purple-300 hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                    <Icon size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {activity.title ||
                        "Notebook Activity"}
                    </h3>

                    {activity.description && (
                      <p className="mt-1 text-sm text-gray-500">
                        {activity.description}
                      </p>
                    )}

                    <p className="mt-1 text-xs text-gray-400">
                      {formatDate(
                        activity.timestamp
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}