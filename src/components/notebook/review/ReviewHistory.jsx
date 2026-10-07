import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ArrowLeft,
  CalendarDays,
  Eye,
  Trash2,
  Pencil,
  Search,
  FileText,
  RefreshCw,
  BarChart3,
} from "lucide-react";

import { useJournal } from "../../../context/JournalContext";

function ReviewHistory({
  onBack,
  onOpenReview,
}) {
  const { selectedAccountId } = useJournal();

  const [reviews, setReviews] = useState([]);

  
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  // ============================================================
  // REVIEW SORT VALUE
  // ============================================================

  const getReviewSortValue = useCallback((review) => {
    const data = review?.data || {};
    let value = "";

    if (review?.type === "Daily") {
      value = data.date || "";
    } else if (review?.type === "Weekly") {
      value =
        data.endDate ||
        data.startDate ||
        "";
    } else if (review?.type === "Quarterly") {
      value =
        data.endDate ||
        data.startDate ||
        (data.year
          ? `${data.year}-12-31`
          : "");
    } else if (review?.type === "Yearly") {
      value =
        data.endDate ||
        data.startDate ||
        (data.year
          ? `${data.year}-12-31`
          : "");
    }

    const timestamp = new Date(value).getTime();

    if (Number.isFinite(timestamp)) {
      return timestamp;
    }

    return 0;
  }, []);

  // ============================================================
  // LOAD REVIEWS
  // ============================================================

  const loadReviews = useCallback(() => {
    const foundReviews = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (!key) {
        continue;
      }

      let type = null;

      if (
        key.startsWith(
          "edgefinder-daily-review-"
        )
      ) {
        type = "Daily";
      } else if (
        key.startsWith(
          "edgefinder-weekly-review-"
        )
      ) {
        type = "Weekly";
      } else if (
        key.startsWith(
          "edgefinder-quarterly-review-"
        )
      ) {
        type = "Quarterly";
      } else if (
        key.startsWith(
          "edgefinder-yearly-review-"
        )
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

        if (
          !data ||
          typeof data !== "object"
        ) {
          continue;
        }
        
        const currentAccountId =
          selectedAccountId !== undefined &&
          selectedAccountId !== null
            ? String(selectedAccountId).trim()
            : "";
        
        const reviewAccountId =
          data?.accountId !== undefined &&
          data?.accountId !== null
            ? String(data.accountId).trim()
            : "";
        
        if (
          !currentAccountId ||
          !reviewAccountId ||
          reviewAccountId !== currentAccountId
        ) {
          continue;
        }
        
        foundReviews.push({
          key,
          type,
          data,
        });
      } catch (error) {
        console.error(
          "Failed to read review:",
          key,
          error
        );
      }
    }

    foundReviews.sort((a, b) => {
      return (
        getReviewSortValue(b) -
        getReviewSortValue(a)
      );
    });

    setReviews(foundReviews);
  }, [
    getReviewSortValue,
    selectedAccountId,
  ]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // ============================================================
  // REVIEW TITLE
  // ============================================================

  const getTitle = (review) => {
    const data = review?.data || {};

    if (review?.type === "Daily") {
      return data.date || "Daily Review";
    }

    if (review?.type === "Weekly") {
      if (data.week) {
        return data.week;
      }

      if (
        data.startDate &&
        data.endDate
      ) {
        return `${data.startDate} → ${data.endDate}`;
      }

      return "Weekly Review";
    }

    if (review?.type === "Quarterly") {
      const quarter =
        data.quarter || "Quarter";

      const year =
        data.year || "";

      return `${quarter} ${year}`.trim();
    }

    if (review?.type === "Yearly") {
      return data.year || "Yearly Review";
    }

    return "Review";
  };

  // ============================================================
  // PERIOD DESCRIPTION
  // ============================================================

  const getPeriod = (review) => {
    const data = review?.data || {};

    if (review?.type === "Daily") {
      return (
        data.date ||
        "Date not specified"
      );
    }

    if (review?.type === "Weekly") {
      if (
        data.startDate &&
        data.endDate
      ) {
        return `${data.startDate} → ${data.endDate}`;
      }

      return "Period not specified";
    }

    if (review?.type === "Quarterly") {
      if (
        data.startDate &&
        data.endDate
      ) {
        return `${data.startDate} → ${data.endDate}`;
      }

      return "Quarter period";
    }

    if (review?.type === "Yearly") {
      if (
        data.startDate &&
        data.endDate
      ) {
        return `${data.startDate} → ${data.endDate}`;
      }

      if (data.year) {
        return `January 1 → December 31, ${data.year}`;
      }

      return "Year period";
    }

    return "";
  };

  // ============================================================
  // STATS
  // ============================================================

  const getStats = (review) => {
    const data = review?.data || {};

    return {
      trades:
        data.totalTrades ?? 0,

      winRate:
        data.winRate !== undefined &&
        data.winRate !== null
          ? `${data.winRate}%`
          : "0%",

      netPL:
        data.netPL ?? 0,

      netR:
        data.netR ?? 0,
    };
  };

  // ============================================================
  // FILTER
  // ============================================================

  const filteredReviews = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return reviews.filter((review) => {
      const matchesType =
        activeFilter === "All" ||
        review.type === activeFilter;

      if (!matchesType) {
        return false;
      }

      if (!query) {
        return true;
      }

      const dataText = Object.values(
        review.data || {}
      )
        .filter(
          (value) =>
            value !== null &&
            value !== undefined
        )
        .join(" ")
        .toLowerCase();

      const searchableText =
        `${review.type} ${getTitle(
          review
        )} ${getPeriod(
          review
        )} ${dataText}`;

      return searchableText.includes(
        query
      );
    });
  }, [
    reviews,
    search,
    activeFilter,
  ]);

  // ============================================================
  // DELETE
  // ============================================================

  const handleDelete = (key) => {
    const confirmed =
      window.confirm(
        "Are you sure you want to permanently delete this review?"
      );

    if (!confirmed) {
      return;
    }

    localStorage.removeItem(key);

    setReviews((prev) =>
      prev.filter(
        (review) =>
          review.key !== key
      )
    );
  };

  // ============================================================
  // OPEN / EDIT
  // ============================================================

  const handleOpen = (review) => {
    if (!onOpenReview) {
      return;
    }

    onOpenReview(review);
  };

  // ============================================================
  // FORMAT MONEY
  // ============================================================

  const formatMoney = (value) => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "$0.00";
    }

    return number.toLocaleString(
      "en-US",
      {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  };

  // ============================================================
  // TYPE STYLE
  // ============================================================

  const getTypeClass = (type) => {
    if (type === "Daily") {
      return "bg-blue-50 text-blue-700 border-blue-100";
    }

    if (type === "Weekly") {
      return "bg-purple-50 text-purple-700 border-purple-100";
    }

    if (type === "Quarterly") {
      return "bg-amber-50 text-amber-700 border-amber-100";
    }

    if (type === "Yearly") {
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    }

    return "bg-gray-50 text-gray-600 border-gray-100";
  };

  // ============================================================
  // COUNTS
  // ============================================================

  const counts = useMemo(() => {
    return {
      All: reviews.length,

      Daily:
        reviews.filter(
          (review) =>
            review.type === "Daily"
        ).length,

      Weekly:
        reviews.filter(
          (review) =>
            review.type === "Weekly"
        ).length,

      Quarterly:
        reviews.filter(
          (review) =>
            review.type === "Quarterly"
        ).length,

      Yearly:
        reviews.filter(
          (review) =>
            review.type === "Yearly"
        ).length,
    };
  }, [reviews]);

  // ============================================================
  // REVIEW SUMMARY STATS
  // ============================================================

  const summaryStats = useMemo(() => {
    const totalReviews = reviews.length;

    const totalTrades = reviews.reduce(
      (sum, review) =>
        sum +
        Number(
          review?.data?.totalTrades ?? 0
        ),
      0
    );

    const netPL = reviews.reduce(
      (sum, review) =>
        sum +
        Number(
          review?.data?.netPL ?? 0
        ),
      0
    );

    return {
      totalReviews,
      daily: counts.Daily,
      weekly: counts.Weekly,
      quarterly: counts.Quarterly,
      yearly: counts.Yearly,
      totalTrades,
      netPL,
    };
  }, [reviews, counts]);

  return (
    <div className="min-h-full pb-10">

      {/* HEADER */}

      <div className="mb-5 flex items-center justify-between">

        <div className="flex items-center gap-3">

          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Review History
            </h1>

            <p className="text-sm text-gray-500">
              View, edit and manage your saved trading reviews.
            </p>
          </div>

        </div>

        <button
          onClick={loadReviews}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>

      </div>

      {/* REVIEW SUMMARY */}

      {reviews.length > 0 && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Total Reviews
                  </p>

                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {summaryStats.totalReviews}
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                  <FileText size={19} />
                </div>

              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Review Types
                  </p>

                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {
                      [
                        summaryStats.daily > 0,
                        summaryStats.weekly > 0,
                        summaryStats.quarterly > 0,
                        summaryStats.yearly > 0,
                      ].filter(Boolean).length
                    }
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <BarChart3 size={19} />
                </div>

              </div>

              <p className="mt-1 text-xs text-gray-500">
                Active review categories
              </p>

            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Reviewed Trades
                  </p>

                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {summaryStats.totalTrades}
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <CalendarDays size={19} />
                </div>

              </div>

              <p className="mt-1 text-xs text-gray-500">
                Across saved reviews
              </p>

            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Review Net P/L
                  </p>

                  <p
                    className={`mt-1 text-2xl font-semibold ${
                      summaryStats.netPL > 0
                        ? "text-green-600"
                        : summaryStats.netPL < 0
                          ? "text-red-600"
                          : "text-gray-900"
                    }`}
                  >
                    {formatMoney(
                      summaryStats.netPL
                    )}
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <BarChart3 size={19} />
                </div>

              </div>

              <p className="mt-1 text-xs text-gray-500">
                Sum of saved review results
              </p>

            </div>

          </div>

          {/* REVIEW BREAKDOWN */}

          <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">

            <div className="mb-3">

              <h2 className="text-sm font-semibold text-gray-900">
                Review Breakdown
              </h2>

              <p className="mt-0.5 text-xs text-gray-500">
                Saved reviews by time period
              </p>

            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">

              <div className="rounded-lg bg-blue-50 px-3 py-2.5">
                <p className="text-xs font-medium text-blue-600">
                  Daily
                </p>

                <p className="mt-0.5 text-lg font-semibold text-blue-800">
                  {summaryStats.daily}
                </p>
              </div>

              <div className="rounded-lg bg-purple-50 px-3 py-2.5">
                <p className="text-xs font-medium text-purple-600">
                  Weekly
                </p>

                <p className="mt-0.5 text-lg font-semibold text-purple-800">
                  {summaryStats.weekly}
                </p>
              </div>

              <div className="rounded-lg bg-amber-50 px-3 py-2.5">
                <p className="text-xs font-medium text-amber-600">
                  Quarterly
                </p>

                <p className="mt-0.5 text-lg font-semibold text-amber-800">
                  {summaryStats.quarterly}
                </p>
              </div>

              <div className="rounded-lg bg-emerald-50 px-3 py-2.5">
                <p className="text-xs font-medium text-emerald-600">
                  Yearly
                </p>

                <p className="mt-0.5 text-lg font-semibold text-emerald-800">
                  {summaryStats.yearly}
                </p>
              </div>

            </div>

          </div>
        </>
      )}

      {/* FILTER TABS */}

      <div className="mb-4 flex flex-wrap gap-2">

        {[
          "All",
          "Daily",
          "Weekly",
          "Quarterly",
          "Yearly",
        ].map((filter) => (

          <button
            key={filter}
            onClick={() =>
              setActiveFilter(filter)
            }
            className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
              activeFilter === filter
                ? "border-purple-200 bg-purple-50 text-purple-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {filter}

            <span className="ml-1.5 text-xs opacity-60">
              {counts[filter]}
            </span>

          </button>

        ))}

      </div>

      {/* SEARCH */}

      <div className="mb-5">

        <div className="relative max-w-lg">

          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            placeholder="Search reviews..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-800 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          />

        </div>

      </div>

      {/* SUMMARY */}

      {reviews.length > 0 && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <FileText size={18} />
            </div>

            <div>

              <p className="text-sm font-semibold text-gray-900">
                {filteredReviews.length}{" "}
                {filteredReviews.length === 1
                  ? "review"
                  : "reviews"}
              </p>

              <p className="text-xs text-gray-500">
                {reviews.length} total saved
              </p>

            </div>

          </div>

        </div>
      )}

      {/* EMPTY STATE */}

      {filteredReviews.length === 0 && (

        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">

          <CalendarDays
            size={34}
            className="mx-auto mb-3 text-gray-400"
          />

          <h2 className="text-base font-semibold text-gray-900">
            {reviews.length === 0
              ? "No saved reviews"
              : "No reviews found"}
          </h2>

          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            {reviews.length === 0
              ? "Your Daily, Weekly, Quarterly and Yearly reviews will appear here after you save them."
              : "Try another search term or select a different review type."}
          </p>

        </div>

      )}

      {/* REVIEW LIST */}

      <div className="space-y-3">

        {filteredReviews.map((review) => {

          const stats = getStats(review);

          return (

            <div
              key={review.key}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-purple-200 hover:shadow"
            >

              <div className="flex items-start justify-between gap-4">

                <div className="flex items-start gap-4">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                    <CalendarDays size={20} />
                  </div>

                  <div>

                    <div className="flex flex-wrap items-center gap-2">

                      <h3 className="text-sm font-semibold text-gray-900">
                        {review.type} Review
                      </h3>

                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getTypeClass(
                          review.type
                        )}`}
                      >
                        {review.type}
                      </span>

                    </div>

                    <p className="mt-1 text-sm font-medium text-gray-700">
                      {getTitle(review)}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {getPeriod(review)}
                    </p>

                  </div>

                </div>

                <div className="flex shrink-0 items-center gap-2">

                  <button
                    onClick={() =>
                      handleOpen(review)
                    }
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                  >
                    <Eye size={16} />
                    View
                  </button>

                  <button
                    onClick={() =>
                      handleOpen(review)
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
                    title="Edit review"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    onClick={() =>
                      handleDelete(
                        review.key
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-white text-red-500 transition hover:bg-red-50"
                    title="Delete review"
                  >
                    <Trash2 size={16} />
                  </button>

                </div>

              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-4 md:grid-cols-4">

                <div className="rounded-lg bg-gray-50 px-3 py-2">

                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Trades
                  </p>

                  <p className="mt-0.5 text-sm font-semibold text-gray-800">
                    {stats.trades}
                  </p>

                </div>

                <div className="rounded-lg bg-gray-50 px-3 py-2">

                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Win Rate
                  </p>

                  <p className="mt-0.5 text-sm font-semibold text-gray-800">
                    {stats.winRate}
                  </p>

                </div>

                <div className="rounded-lg bg-gray-50 px-3 py-2">

                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Net P/L
                  </p>

                  <p
                    className={`mt-0.5 text-sm font-semibold ${
                      Number(stats.netPL) > 0
                        ? "text-green-600"
                        : Number(stats.netPL) < 0
                          ? "text-red-600"
                          : "text-gray-800"
                    }`}
                  >
                    {formatMoney(
                      stats.netPL
                    )}
                  </p>

                </div>

                <div className="rounded-lg bg-gray-50 px-3 py-2">

                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Net R
                  </p>

                  <p
                    className={`mt-0.5 text-sm font-semibold ${
                      Number(stats.netR) > 0
                        ? "text-green-600"
                        : Number(stats.netR) < 0
                          ? "text-red-600"
                          : "text-gray-800"
                    }`}
                  >
                    {stats.netR}
                  </p>

                </div>

              </div>

            </div>

          );
        })}

      </div>

    </div>
  );
}

export default ReviewHistory;