{/* FILE: src/components/notebook/TemplateGrid.jsx */}

import { useState } from "react";
import TemplateCard from "./TemplateCard";

import DailyReview from "./review/DailyReview";
import WeeklyReview from "./review/WeeklyReview";
import QuarterlyReview from "./review/QuarterlyReview";
import YearlyReview from "./review/YearlyReview";
import ReviewHistory from "./review/ReviewHistory";
import ReviewAnalytics from "./review/ReviewAnalytics";

function TemplateGrid() {
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [editingReview, setEditingReview] = useState(null);
  const [reviews, setReviews] = useState([]);

  const loadReviews = () => {
    const foundReviews = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (!key) {
        continue;
      }

      let type = null;

      if (key.startsWith("edgefinder-daily-review-")) {
        type = "Daily";
      } else if (
        key.startsWith("edgefinder-weekly-review-")
      ) {
        type = "Weekly";
      } else if (
        key.startsWith("edgefinder-quarterly-review-")
      ) {
        type = "Quarterly";
      } else if (
        key.startsWith("edgefinder-yearly-review-")
      ) {
        type = "Yearly";
      }

      if (!type) {
        continue;
      }

      try {
        const raw = localStorage.getItem(key);

        if (!raw) {
          continue;
        }

        const data = JSON.parse(raw);

        if (!data || typeof data !== "object") {
          continue;
        }

        foundReviews.push({
          key,
          type,
          data,
        });
      } catch (error) {
        console.error(
          "Failed to load review:",
          key,
          error
        );
      }
    }

    setReviews(foundReviews);

    return foundReviews;
  };

  const handleBack = () => {
    setActiveTemplate(null);
    setEditingReview(null);
  };

  const handleOpenReview = (review) => {
    setEditingReview(review);
    setActiveTemplate(review.type.toLowerCase());
  };

  const handleOpenHistory = () => {
    loadReviews();
    setEditingReview(null);
    setActiveTemplate("history");
  };

  const handleOpenAnalytics = () => {
    loadReviews();
    setEditingReview(null);
    setActiveTemplate("analytics");
  };

  if (activeTemplate === "daily") {
    return (
      <DailyReview
        onBack={handleBack}
        initialData={editingReview?.data || null}
        reviewKey={editingReview?.key || null}
      />
    );
  }

  if (activeTemplate === "weekly") {
    return (
      <WeeklyReview
        onBack={handleBack}
        initialData={editingReview?.data || null}
        reviewKey={editingReview?.key || null}
      />
    );
  }

  if (activeTemplate === "quarterly") {
    return (
      <QuarterlyReview
        onBack={handleBack}
        initialData={editingReview?.data || null}
        reviewKey={editingReview?.key || null}
      />
    );
  }

  if (activeTemplate === "yearly") {
    return (
      <YearlyReview
        onBack={handleBack}
        initialData={editingReview?.data || null}
        reviewKey={editingReview?.key || null}
      />
    );
  }

  if (activeTemplate === "history") {
    return (
      <ReviewHistory
        onBack={handleBack}
        onOpenReview={handleOpenReview}
      />
    );
  }

  if (activeTemplate === "analytics") {
    return (
      <ReviewAnalytics
        reviews={reviews}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="space-y-5 mt-3">

      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">

        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Trading Reviews
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Review your trading performance and track your progress.
          </p>
        </div>

        <div className="flex items-center gap-2">

          <button
            onClick={handleOpenAnalytics}
            className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 transition hover:bg-purple-100"
          >
            Review Analytics
          </button>

          <button
            onClick={handleOpenHistory}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
          >
            Review History
          </button>

        </div>

      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">

        <TemplateCard
          title="Morning Routine"
        />

        <TemplateCard
          title="Daily Planner"
        />

        <TemplateCard
          title="Goal Tracker"
        />

        <TemplateCard
          title="Habit Tracker"
        />

        <TemplateCard
          title="Daily Review"
          onClick={() => {
            setEditingReview(null);
            setActiveTemplate("daily");
          }}
        />

        <TemplateCard
          title="Weekly Review"
          onClick={() => {
            setEditingReview(null);
            setActiveTemplate("weekly");
          }}
        />

        <TemplateCard
          title="Quarterly Review"
          onClick={() => {
            setEditingReview(null);
            setActiveTemplate("quarterly");
          }}
        />

        <TemplateCard
          title="Yearly Review"
          onClick={() => {
            setEditingReview(null);
            setActiveTemplate("yearly");
          }}
        />

        <TemplateCard
          title="Review History"
          onClick={handleOpenHistory}
        />

        <TemplateCard
          title="Review Analytics"
          onClick={handleOpenAnalytics}
        />

      </div>
    </div>
  );
}

export default TemplateGrid;