// FILE: src/components/notebook/review/ReviewAnalytics.jsx

import { useMemo } from "react";

import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  Award,
  AlertTriangle,
} from "lucide-react";

function ReviewAnalytics({
  reviews = [],
  onBack,
}) {
  const getNumber = (value) => {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  };

  const getReviewDate = (review) => {
    const data = review?.data || {};

    const value =
      data.endDate ||
      data.date ||
      data.startDate ||
      (data.year
        ? `${data.year}-12-31`
        : "");

    const timestamp =
      new Date(value).getTime();

    return Number.isFinite(timestamp)
      ? timestamp
      : 0;
  };

  const getReviewTitle = (review) => {
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
      return `${data.quarter || "Quarter"} ${
        data.year || ""
      }`.trim();
    }

    if (review?.type === "Yearly") {
      return data.year || "Yearly Review";
    }

    return "Review";
  };

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

  const analytics = useMemo(() => {
    const validReviews = Array.isArray(reviews)
      ? reviews.filter(Boolean)
      : [];

    const sortedReviews = [...validReviews].sort(
      (a, b) =>
        getReviewDate(a) -
        getReviewDate(b)
    );

    const totalReviews =
      validReviews.length;

    const averageWinRate =
      totalReviews > 0
        ? validReviews.reduce(
            (sum, review) =>
              sum +
              getNumber(
                review?.data?.winRate
              ),
            0
          ) / totalReviews
        : 0;

    const averageNetPL =
      totalReviews > 0
        ? validReviews.reduce(
            (sum, review) =>
              sum +
              getNumber(
                review?.data?.netPL
              ),
            0
          ) / totalReviews
        : 0;

    const profitableReviews =
      validReviews.filter(
        (review) =>
          getNumber(
            review?.data?.netPL
          ) > 0
      ).length;

    const losingReviews =
      validReviews.filter(
        (review) =>
          getNumber(
            review?.data?.netPL
          ) < 0
      ).length;

    const consistency =
      totalReviews > 0
        ? (profitableReviews /
            totalReviews) *
          100
        : 0;

    const bestReview =
      validReviews.length > 0
        ? validReviews.reduce(
            (best, review) =>
              getNumber(
                review?.data?.netPL
              ) >
              getNumber(
                best?.data?.netPL
              )
                ? review
                : best,
            validReviews[0]
          )
        : null;

    const worstReview =
      validReviews.length > 0
        ? validReviews.reduce(
            (worst, review) =>
              getNumber(
                review?.data?.netPL
              ) <
              getNumber(
                worst?.data?.netPL
              )
                ? review
                : worst,
            validReviews[0]
          )
        : null;

    return {
      validReviews,
      sortedReviews,
      totalReviews,
      averageWinRate:
        Number(
          averageWinRate.toFixed(2)
        ),
      averageNetPL:
        Number(
          averageNetPL.toFixed(2)
        ),
      profitableReviews,
      losingReviews,
      consistency:
        Number(
          consistency.toFixed(2)
        ),
      bestReview,
      worstReview,
    };
  }, [reviews]);

  const typeAnalytics = useMemo(() => {
    const types = [
      "Daily",
      "Weekly",
      "Quarterly",
      "Yearly",
    ];

    return types.map((type) => {
      const typeReviews =
        analytics.validReviews.filter(
          (review) =>
            review.type === type
        );

      const count =
        typeReviews.length;

      const averageWinRate =
        count > 0
          ? typeReviews.reduce(
              (sum, review) =>
                sum +
                getNumber(
                  review?.data?.winRate
                ),
              0
            ) / count
          : 0;

      const averagePL =
        count > 0
          ? typeReviews.reduce(
              (sum, review) =>
                sum +
                getNumber(
                  review?.data?.netPL
                ),
              0
            ) / count
          : 0;

      const profitable =
        typeReviews.filter(
          (review) =>
            getNumber(
              review?.data?.netPL
            ) > 0
        ).length;

      return {
        type,
        count,
        averageWinRate:
          Number(
            averageWinRate.toFixed(2)
          ),
        averagePL:
          Number(
            averagePL.toFixed(2)
          ),
        profitable,
      };
    });
  }, [analytics.validReviews]);

  const getPLClass = (value) => {
    if (value > 0) {
      return "text-green-600";
    }

    if (value < 0) {
      return "text-red-600";
    }

    return "text-gray-900";
  };

  const getTypeClass = (type) => {
    if (type === "Daily") {
      return "bg-blue-50 text-blue-700";
    }

    if (type === "Weekly") {
      return "bg-purple-50 text-purple-700";
    }

    if (type === "Quarterly") {
      return "bg-amber-50 text-amber-700";
    }

    return "bg-emerald-50 text-emerald-700";
  };

  return (
    <div className="min-h-full pb-10">

      {/* HEADER */}

      <div className="mb-6 flex items-center justify-between">

        <div className="flex items-center gap-3">

          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Review Analytics
            </h1>

            <p className="text-sm text-gray-500">
              Analyze your review performance and trading consistency.
            </p>
          </div>

        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
          <BarChart3 size={20} />
        </div>

      </div>

      {/* EMPTY */}

      {analytics.totalReviews === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">

          <BarChart3
            size={38}
            className="mx-auto mb-3 text-gray-400"
          />

          <h2 className="text-base font-semibold text-gray-900">
            No Analytics Available
          </h2>

          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            Save some trading reviews first. Your analytics will automatically appear here.
          </p>

        </div>
      ) : (
        <div className="space-y-5">

          {/* MAIN METRICS */}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">

              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Reviews
              </p>

              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {analytics.totalReviews}
              </p>

            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">

              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Avg Win Rate
              </p>

              <p className="mt-1 text-2xl font-semibold text-purple-600">
                {analytics.averageWinRate}%
              </p>

            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">

              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Avg Net P/L
              </p>

              <p
                className={`mt-1 text-2xl font-semibold ${getPLClass(
                  analytics.averageNetPL
                )}`}
              >
                {formatMoney(
                  analytics.averageNetPL
                )}
              </p>

            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">

              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Consistency
              </p>

              <p className="mt-1 text-2xl font-semibold text-emerald-600">
                {analytics.consistency}%
              </p>

            </div>

          </div>

          {/* CONSISTENCY */}

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

            <div className="mb-5 flex items-center gap-2">

              <Activity
                size={19}
                className="text-purple-600"
              />

              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Trading Consistency
                </h2>

                <p className="text-xs text-gray-500">
                  How consistently your saved reviews show profitable results.
                </p>
              </div>

            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

              <div className="rounded-lg bg-green-50 p-4">

                <p className="text-xs font-medium uppercase tracking-wide text-green-600">
                  Profitable Reviews
                </p>

                <p className="mt-1 text-2xl font-semibold text-green-700">
                  {analytics.profitableReviews}
                </p>

              </div>

              <div className="rounded-lg bg-red-50 p-4">

                <p className="text-xs font-medium uppercase tracking-wide text-red-600">
                  Losing Reviews
                </p>

                <p className="mt-1 text-2xl font-semibold text-red-700">
                  {analytics.losingReviews}
                </p>

              </div>

              <div className="rounded-lg bg-purple-50 p-4">

                <p className="text-xs font-medium uppercase tracking-wide text-purple-600">
                  Profitability Rate
                </p>

                <p className="mt-1 text-2xl font-semibold text-purple-700">
                  {analytics.consistency}%
                </p>

              </div>

            </div>

          </section>

          {/* BEST / WORST */}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

              <div className="mb-4 flex items-center gap-2">

                <Award
                  size={19}
                  className="text-green-600"
                />

                <h2 className="text-base font-semibold text-gray-900">
                  Best Performing Review
                </h2>

              </div>

              <div className="rounded-lg bg-green-50 p-4">

                <div className="flex items-center justify-between">

                  <div>

                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getTypeClass(
                        analytics.bestReview?.type
                      )}`}
                    >
                      {analytics.bestReview?.type}
                    </span>

                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {getReviewTitle(
                        analytics.bestReview
                      )}
                    </p>

                  </div>

                  <p className="text-lg font-semibold text-green-600">
                    {formatMoney(
                      analytics.bestReview?.data?.netPL
                    )}
                  </p>

                </div>

              </div>

            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

              <div className="mb-4 flex items-center gap-2">

                <AlertTriangle
                  size={19}
                  className="text-red-500"
                />

                <h2 className="text-base font-semibold text-gray-900">
                  Worst Performing Review
                </h2>

              </div>

              <div className="rounded-lg bg-red-50 p-4">

                <div className="flex items-center justify-between">

                  <div>

                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getTypeClass(
                        analytics.worstReview?.type
                      )}`}
                    >
                      {analytics.worstReview?.type}
                    </span>

                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {getReviewTitle(
                        analytics.worstReview
                      )}
                    </p>

                  </div>

                  <p className="text-lg font-semibold text-red-600">
                    {formatMoney(
                      analytics.worstReview?.data?.netPL
                    )}
                  </p>

                </div>

              </div>

            </section>

          </div>

          {/* TYPE PERFORMANCE */}

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

            <div className="mb-5 flex items-center gap-2">

              <Target
                size={19}
                className="text-purple-600"
              />

              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Performance by Review Type
                </h2>

                <p className="text-xs text-gray-500">
                  Compare your Daily, Weekly, Quarterly and Yearly reviews.
                </p>
              </div>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full min-w-[650px] text-left">

                <thead>
                  <tr className="border-b border-gray-100">

                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Review Type
                    </th>

                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Reviews
                    </th>

                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Avg Win Rate
                    </th>

                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Avg Net P/L
                    </th>

                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Profitable
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {typeAnalytics.map(
                    (item) => (
                      <tr
                        key={item.type}
                        className="border-b border-gray-50 last:border-0"
                      >

                        <td className="px-3 py-3">

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${getTypeClass(
                              item.type
                            )}`}
                          >
                            {item.type}
                          </span>

                        </td>

                        <td className="px-3 py-3 text-sm font-medium text-gray-800">
                          {item.count}
                        </td>

                        <td className="px-3 py-3 text-sm font-medium text-gray-800">
                          {item.averageWinRate}%
                        </td>

                        <td
                          className={`px-3 py-3 text-sm font-semibold ${getPLClass(
                            item.averagePL
                          )}`}
                        >
                          {formatMoney(
                            item.averagePL
                          )}
                        </td>

                        <td className="px-3 py-3 text-sm text-gray-600">
                          {item.profitable}
                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>

          </section>

          {/* PERFORMANCE TREND */}

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

            <div className="mb-5 flex items-center gap-2">

              <BarChart3
                size={19}
                className="text-purple-600"
              />

              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Performance Trend
                </h2>

                <p className="text-xs text-gray-500">
                  Net P/L progression across saved reviews.
                </p>
              </div>

            </div>

            <div className="space-y-3">

              {analytics.sortedReviews.map(
                (review, index) => {

                  const pnl =
                    getNumber(
                      review?.data?.netPL
                    );

                  const maxValue =
                    Math.max(
                      ...analytics.sortedReviews.map(
                        (item) =>
                          Math.abs(
                            getNumber(
                              item?.data?.netPL
                            )
                          )
                      ),
                      1
                    );

                  const width =
                    (Math.abs(pnl) /
                      maxValue) *
                    100;

                  return (
                    <div
                      key={
                        review.key ||
                        `${review.type}-${index}`
                      }
                      className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                    >

                      <div className="mb-2 flex items-center justify-between gap-3">

                        <div className="flex min-w-0 items-center gap-2">

                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-medium ${getTypeClass(
                              review.type
                            )}`}
                          >
                            {review.type}
                          </span>

                          <span className="truncate text-sm font-medium text-gray-700">
                            {getReviewTitle(
                              review
                            )}
                          </span>

                        </div>

                        <span
                          className={`shrink-0 text-sm font-semibold ${getPLClass(
                            pnl
                          )}`}
                        >
                          {formatMoney(pnl)}
                        </span>

                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-gray-200">

                        <div
                          className={`h-full rounded-full ${
                            pnl >= 0
                              ? "bg-green-500"
                              : "bg-red-500"
                          }`}
                          style={{
                            width: `${width}%`,
                          }}
                        />

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          </section>

        </div>
      )}

    </div>
  );
}

export default ReviewAnalytics;