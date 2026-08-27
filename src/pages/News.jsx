import { useMemo, useState, useEffect, useCallback } from "react";
import {
  CalendarDays,
  RefreshCw,
  ExternalLink,
  Clock3,
  Search,
  Filter,
  Bell,
  ChevronDown,
  Newspaper,
} from "lucide-react";

import { fetchForexNews } from "../utils/news/newsEngine";

const CURRENCIES = [
  "All",
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "NZD",
  "CHF",
];

const IMPACTS = [
  "All",
  "High",
  "Medium",
  "Low",
];

function getImpactClasses(impact) {
  if (impact === "High") {
    return "bg-red-50 text-red-600 border-red-100";
  }

  if (impact === "Medium") {
    return "bg-orange-50 text-orange-600 border-orange-100";
  }

  return "bg-green-50 text-green-600 border-green-100";
}

function getImpactDot(impact) {
  if (impact === "High") return "bg-red-500";
  if (impact === "Medium") return "bg-orange-500";
  return "bg-green-500";
}

function formatToday() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

function getEventDate(event) {
  if (event?.eventTime instanceof Date) {
    return event.eventTime;
  }

  if (event?.eventTime) {
    const parsed = new Date(event.eventTime);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (event?.date) {
    const parsed = new Date(event.date);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function getCountdown(eventTime) {
  if (!eventTime) return "";

  const diff =
    eventTime.getTime() - Date.now();

  if (diff <= 0) {
    return "Event starting now";
  }

  const totalSeconds = Math.floor(
    diff / 1000
  );

  const days = Math.floor(
    totalSeconds / 86400
  );

  const hours = Math.floor(
    (totalSeconds % 86400) / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const seconds =
    totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(
      2,
      "0"
    )}h ${String(minutes).padStart(
      2,
      "0"
    )}m`;
  }

  return `${String(hours).padStart(
    2,
    "0"
  )}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function getEventTime(event) {
  const eventDate = getEventDate(event);

  if (!eventDate) {
    return event?.time || "—";
  }

  return eventDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSameDay(dateA, dateB) {
  return (
    dateA.getFullYear() ===
      dateB.getFullYear() &&
    dateA.getMonth() ===
      dateB.getMonth() &&
    dateA.getDate() ===
      dateB.getDate()
  );
}

function isTomorrow(date) {
  const tomorrow = new Date();

  tomorrow.setDate(
    tomorrow.getDate() + 1
  );

  return isSameDay(date, tomorrow);
}

function isThisWeek(date) {
  const now = new Date();

  const start = new Date(now);
  const day = start.getDay();

  const diff =
    day === 0 ? 6 : day - 1;

  start.setDate(
    start.getDate() - diff
  );

  start.setHours(0, 0, 0, 0);

  const end = new Date(start);

  end.setDate(
    end.getDate() + 7
  );

  return (
    date >= start &&
    date < end
  );
}

export default function News() {
  const [activeDay, setActiveDay] =
    useState("Today");

  const [impactFilter, setImpactFilter] =
    useState("All");

  const [currencyFilter, setCurrencyFilter] =
    useState("All");

  const [search, setSearch] =
    useState("");

  const [events, setEvents] =
    useState([]);

  const [selectedEvent, setSelectedEvent] =
    useState(null);

  const [lastUpdated, setLastUpdated] =
    useState(null);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [showFilters, setShowFilters] =
    useState(false);

  const [
    showOnlyHighImpact,
    setShowOnlyHighImpact,
  ] = useState(false);

  const [currentTime, setCurrentTime] =
    useState(new Date());

  /*
   * ----------------------------------------------------------
   * LIVE CLOCK
   * ----------------------------------------------------------
   */

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  /*
   * ----------------------------------------------------------
   * LOAD REAL NEWS
   * ----------------------------------------------------------
   */

  const loadNews = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setError("");

        const data =
          await fetchForexNews();

        if (!Array.isArray(data)) {
          throw new Error(
            "Invalid news data received."
          );
        }

        setEvents(data);

        setLastUpdated(
          new Date()
        );
      } catch (err) {
        console.error(
          "Economic calendar error:",
          err
        );

        setError(
          err?.message ||
            "Unable to load live economic calendar."
        );
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  /*
   * ----------------------------------------------------------
   * INITIAL LOAD
   * ----------------------------------------------------------
   */

  useEffect(() => {
    loadNews(true);
  }, [loadNews]);

  /*
   * ----------------------------------------------------------
   * REFRESH
   * ----------------------------------------------------------
   */

  const handleRefresh =
    async () => {
      setIsRefreshing(true);

      await loadNews(false);
    };

  /*
   * ----------------------------------------------------------
   * FILTER EVENTS
   * ----------------------------------------------------------
   */

  const filteredEvents =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return events
        .filter((event) => {
          /*
           * IMPACT
           */

          const matchesImpact =
            impactFilter === "All" ||
            event.impact ===
              impactFilter;

          /*
           * CURRENCY
           */

          const matchesCurrency =
            currencyFilter === "All" ||
            event.currency ===
              currencyFilter;

          /*
           * HIGH IMPACT ONLY
           */

          const matchesHighImpact =
            !showOnlyHighImpact ||
            event.impact ===
              "High";

          /*
           * SEARCH
           */

          const eventName =
            String(
              event.event || ""
            ).toLowerCase();

          const currency =
            String(
              event.currency || ""
            ).toLowerCase();

          const category =
            String(
              event.category || ""
            ).toLowerCase();

          const matchesSearch =
            !query ||
            eventName.includes(query) ||
            currency.includes(query) ||
            category.includes(query);

          /*
           * DAY
           */

          const eventDate =
            getEventDate(event);

          let matchesDay = true;

          if (eventDate) {
            if (
              activeDay ===
              "Today"
            ) {
              matchesDay =
                isSameDay(
                  eventDate,
                  new Date()
                );
            }

            if (
              activeDay ===
              "Tomorrow"
            ) {
              matchesDay =
                isTomorrow(
                  eventDate
                );
            }

            if (
              activeDay ===
              "This Week"
            ) {
              matchesDay =
                isThisWeek(
                  eventDate
                );
            }
          }

          return (
            matchesImpact &&
            matchesCurrency &&
            matchesHighImpact &&
            matchesSearch &&
            matchesDay
          );
        })
        .sort((a, b) => {
          const dateA =
            getEventDate(a);

          const dateB =
            getEventDate(b);

          if (
            dateA &&
            dateB
          ) {
            return (
              dateA.getTime() -
              dateB.getTime()
            );
          }

          return 0;
        });
    }, [
      events,
      activeDay,
      impactFilter,
      currencyFilter,
      search,
      showOnlyHighImpact,
    ]);

  /*
   * ----------------------------------------------------------
   * STATISTICS
   * ----------------------------------------------------------
   */

  const highImpactCount =
    events.filter(
      (event) =>
        event.impact === "High"
    ).length;

  const mediumImpactCount =
    events.filter(
      (event) =>
        event.impact === "Medium"
    ).length;

  const lowImpactCount =
    events.filter(
      (event) =>
        event.impact === "Low"
    ).length;

  /*
   * ----------------------------------------------------------
   * UPCOMING EVENT
   * ----------------------------------------------------------
   */

  const upcomingEvent =
    useMemo(() => {
      const now = new Date();

      return (
        events
          .map((event) => {
            const eventDate =
              getEventDate(event);

            if (!eventDate) {
              return null;
            }

            return {
              ...event,
              eventTime: eventDate,
            };
          })
          .filter(
            (event) =>
              event &&
              event.eventTime >
                now
          )
          .sort(
            (a, b) =>
              a.eventTime.getTime() -
              b.eventTime.getTime()
          )[0] || null
      );
    }, [
      events,
      currentTime,
    ]);

  /*
   * ----------------------------------------------------------
   * RETURN
   * ----------------------------------------------------------
   */

  return (
    <div className="space-y-5 pb-10">

      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div className="flex items-center gap-3">

          <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center">
            <CalendarDays
              size={21}
              className="text-violet-600"
            />
          </div>

          <div>

            <div className="flex items-center gap-3">

              <h1 className="text-2xl font-bold text-gray-900">
                Forex News
              </h1>

              <span className="hidden sm:inline text-sm text-gray-500">
                Economic calendar and market events
              </span>

            </div>

            <div className="flex items-center gap-2 mt-1">

              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />

              <span className="text-xs text-gray-500">
                {loading
                  ? "Loading calendar"
                  : error
                  ? "Calendar unavailable"
                  : "Live calendar"}
              </span>

              <span className="text-xs text-gray-400">
                •
              </span>

              <span className="text-xs text-gray-500">
                {currentTime.toLocaleTimeString(
                  [],
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  }
                )}
              </span>

            </div>

          </div>

        </div>

        <div className="flex items-center gap-2">

          <button
            onClick={
              handleRefresh
            }
            disabled={
              isRefreshing ||
              loading
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50 transition disabled:opacity-60"
          >

            <RefreshCw
              size={15}
              className={
                isRefreshing
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh

          </button>

          <button
            onClick={() =>
              window.open(
                "https://www.forexfactory.com/calendar",
                "_blank",
                "noopener,noreferrer"
              )
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-900 bg-white text-sm font-medium hover:bg-gray-50 transition"
          >

            Open Forex Factory

            <ExternalLink
              size={15}
            />

          </button>

        </div>

      </div>

      {/* ====================================================
          ERROR
      ==================================================== */}

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">

          <div className="flex items-center justify-between gap-3">

            <div>

              <p className="text-sm font-medium text-red-700">
                Live news could not be loaded
              </p>

              <p className="text-xs text-red-500 mt-1">
                {error}
              </p>

            </div>

            <button
              onClick={() =>
                loadNews(true)
              }
              className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700"
            >
              Retry
            </button>

          </div>

        </div>
      )}

      {/* ====================================================
          STATUS BAR
      ==================================================== */}

      <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-2">

            <Newspaper
              size={16}
              className="text-violet-600"
            />

            <span className="text-sm font-medium text-violet-900">
              Economic Calendar
            </span>

            <span className="text-xs text-violet-600">
              {formatToday()}
            </span>

          </div>

          <span className="text-xs text-violet-600">

            {lastUpdated
              ? `Last refreshed ${lastUpdated.toLocaleTimeString(
                  [],
                  {
                    hour: "2-digit",
                    minute:
                      "2-digit",
                  }
                )}`
              : "Waiting for live data..."}

          </span>

        </div>

      </div>

      {/* ====================================================
          DAY FILTERS
      ==================================================== */}

      <div className="bg-white border border-gray-200 rounded-2xl p-3">

        <div className="flex flex-wrap items-center gap-2">

          {[
            "Today",
            "Tomorrow",
            "This Week",
          ].map((day) => (

            <button
              key={day}
              onClick={() =>
                setActiveDay(day)
              }
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeDay === day
                  ? "bg-violet-600 text-white"
                  : "border border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {day}
            </button>

          ))}

          <div className="hidden sm:block w-px h-7 bg-gray-200 mx-1" />

          {IMPACTS.map(
            (impact) => (

              <button
                key={impact}
                onClick={() =>
                  setImpactFilter(
                    impact
                  )
                }
                className={`px-3.5 py-2 rounded-xl text-sm border transition ${
                  impactFilter ===
                  impact
                    ? "bg-gray-900 text-white border-gray-900"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >

                {impact !==
                  "All" && (
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${getImpactDot(
                      impact
                    )}`}
                  />
                )}

                {impact}

              </button>

            )
          )}

          <button
            onClick={() =>
              setShowFilters(
                !showFilters
              )
            }
            className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm hover:bg-gray-50"
          >

            <Filter size={15} />

            Filters

            <ChevronDown
              size={14}
              className={`transition ${
                showFilters
                  ? "rotate-180"
                  : ""
              }`}
            />

          </button>

        </div>

        {/* ADVANCED FILTERS */}

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col lg:flex-row gap-3">

            <div className="relative flex-1">

              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Search events, currencies..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-violet-400"
              />

            </div>

            <select
              value={
                currencyFilter
              }
              onChange={(e) =>
                setCurrencyFilter(
                  e.target.value
                )
              }
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none"
            >

              {CURRENCIES.map(
                (currency) => (

                  <option
                    key={currency}
                    value={currency}
                  >
                    {currency ===
                    "All"
                      ? "All Currencies"
                      : currency}
                  </option>

                )
              )}

            </select>

            <button
              onClick={() =>
                setShowOnlyHighImpact(
                  !showOnlyHighImpact
                )
              }
              className={`px-4 py-2.5 rounded-xl border text-sm ${
                showOnlyHighImpact
                  ? "bg-red-50 border-red-200 text-red-600"
                  : "border-gray-200 text-gray-700"
              }`}
            >
              High impact only
            </button>

          </div>
        )}

      </div>

      {/* ====================================================
          SUMMARY CARDS
      ==================================================== */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        <SummaryCard
          title="Total Events"
          value={
            loading
              ? "—"
              : events.length
          }
          icon={
            <CalendarDays
              size={17}
            />
          }
        />

        <SummaryCard
          title="High Impact"
          value={
            loading
              ? "—"
              : highImpactCount
          }
          icon={
            <span className="w-3 h-3 rounded-full bg-red-500" />
          }
        />

        <SummaryCard
          title="Medium Impact"
          value={
            loading
              ? "—"
              : mediumImpactCount
          }
          icon={
            <span className="w-3 h-3 rounded-full bg-orange-500" />
          }
        />

        <SummaryCard
          title="Low Impact"
          value={
            loading
              ? "—"
              : lowImpactCount
          }
          icon={
            <span className="w-3 h-3 rounded-full bg-green-500" />
          }
        />

      </div>

      {/* ====================================================
          LOADING
      ==================================================== */}

      {loading && (
        <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center">

          <RefreshCw
            size={30}
            className="mx-auto text-violet-500 animate-spin mb-3"
          />

          <p className="text-sm font-semibold text-gray-700">
            Loading live economic calendar...
          </p>

          <p className="text-xs text-gray-400 mt-1">
            Fetching latest economic events
          </p>

        </div>
      )}

      {/* ====================================================
          UPCOMING EVENT
      ==================================================== */}

      {!loading &&
        upcomingEvent && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5">

            <div className="flex items-center justify-between mb-4">

              <div className="flex items-center gap-2">

                <Clock3
                  size={17}
                  className="text-violet-600"
                />

                <h2 className="font-semibold text-gray-900">
                  Upcoming Event
                </h2>

              </div>

              <div className="text-right">

                <p className="text-xs text-gray-400">
                  Next scheduled event
                </p>

                <p className="text-sm font-semibold text-violet-600 mt-1">
                  {getCountdown(
                    upcomingEvent.eventTime
                  )}
                </p>

              </div>

            </div>

            <button
              onClick={() =>
                setSelectedEvent(
                  upcomingEvent
                )
              }
              className="w-full text-left rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition p-4"
            >

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                <div>

                  <div className="flex items-center gap-2 mb-2">

                    <span className="text-sm font-bold text-gray-900">
                      {getEventTime(
                        upcomingEvent
                      )}
                    </span>

                    <span className="text-sm font-semibold text-gray-700">
                      {
                        upcomingEvent.currency
                      }
                    </span>

                    <ImpactBadge
                      impact={
                        upcomingEvent.impact
                      }
                    />

                  </div>

                  <p className="font-semibold text-gray-900">
                    {
                      upcomingEvent.event
                    }
                  </p>

                </div>

                <span className="text-xs text-gray-500">
                  View details →
                </span>

              </div>

            </button>

          </div>
        )}

      {/* ====================================================
          NEWS TABLE
      ==================================================== */}

      {!loading && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">

          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">

            <div>

              <h2 className="font-semibold text-gray-900">
                Economic Calendar
              </h2>

              <p className="text-xs text-gray-500 mt-1">
                {filteredEvents.length} events shown
              </p>

            </div>

            <Bell
              size={17}
              className="text-gray-400"
            />

          </div>

          {/* DESKTOP TABLE */}

          <div className="hidden md:block overflow-x-auto">

            <table className="w-full">

              <thead>

                <tr className="bg-gray-50 border-b border-gray-200 text-left">

                  <th className="px-5 py-3 text-xs font-medium text-gray-500">
                    Time
                  </th>

                  <th className="px-5 py-3 text-xs font-medium text-gray-500">
                    Currency
                  </th>

                  <th className="px-5 py-3 text-xs font-medium text-gray-500">
                    Impact
                  </th>

                  <th className="px-5 py-3 text-xs font-medium text-gray-500">
                    Event
                  </th>

                  <th className="px-5 py-3 text-xs font-medium text-gray-500 text-right">
                    Actual
                  </th>

                  <th className="px-5 py-3 text-xs font-medium text-gray-500 text-right">
                    Forecast
                  </th>

                  <th className="px-5 py-3 text-xs font-medium text-gray-500 text-right">
                    Previous
                  </th>

                </tr>

              </thead>

              <tbody>

                {filteredEvents.map(
                  (event) => (

                    <tr
                      key={event.id}
                      onClick={() =>
                        setSelectedEvent(
                          event
                        )
                      }
                      className="border-b border-gray-100 hover:bg-violet-50/40 cursor-pointer transition"
                    >

                      <td className="px-5 py-4 text-sm font-semibold text-gray-900 whitespace-nowrap">
                        {getEventTime(
                          event
                        )}
                      </td>

                      <td className="px-5 py-4">

                        <span className="text-sm font-semibold text-gray-800">
                          {
                            event.currency
                          }
                        </span>

                      </td>

                      <td className="px-5 py-4">

                        <ImpactBadge
                          impact={
                            event.impact
                          }
                        />

                      </td>

                      <td className="px-5 py-4">

                        <div>

                          <p className="text-sm font-medium text-gray-900">
                            {
                              event.event
                            }
                          </p>

                          <p className="text-xs text-gray-400 mt-1">
                            {
                              event.category ||
                              "Economic"
                            }
                          </p>

                        </div>

                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600 text-right">
                        {
                          event.actual ??
                          "—"
                        }
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600 text-right">
                        {
                          event.forecast ??
                          "—"
                        }
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600 text-right">
                        {
                          event.previous ??
                          "—"
                        }
                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

          {/* MOBILE */}

          <div className="md:hidden divide-y divide-gray-100">

            {filteredEvents.map(
              (event) => (

                <button
                  key={event.id}
                  onClick={() =>
                    setSelectedEvent(
                      event
                    )
                  }
                  className="w-full text-left p-4 hover:bg-gray-50"
                >

                  <div className="flex items-start justify-between gap-3">

                    <div>

                      <div className="flex items-center gap-2 mb-2">

                        <span className="font-semibold text-sm">
                          {getEventTime(
                            event
                          )}
                        </span>

                        <span className="font-semibold text-sm">
                          {
                            event.currency
                          }
                        </span>

                      </div>

                      <p className="font-medium text-gray-900">
                        {
                          event.event
                        }
                      </p>

                    </div>

                    <ImpactBadge
                      impact={
                        event.impact
                      }
                    />

                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4">

                    <MiniValue
                      label="Actual"
                      value={
                        event.actual ??
                        "—"
                      }
                    />

                    <MiniValue
                      label="Forecast"
                      value={
                        event.forecast ??
                        "—"
                      }
                    />

                    <MiniValue
                      label="Previous"
                      value={
                        event.previous ??
                        "—"
                      }
                    />

                  </div>

                </button>

              )
            )}

          </div>

          {/* EMPTY */}

          {filteredEvents.length ===
            0 && (
            <div className="py-16 text-center">

              <Search
                size={32}
                className="mx-auto text-gray-300 mb-3"
              />

              <h3 className="font-semibold text-gray-700">
                No events found
              </h3>

              <p className="text-sm text-gray-400 mt-1">
                Try changing your filters or search.
              </p>

            </div>
          )}

        </div>
      )}

      {/* ====================================================
          SOURCE NOTE
      ==================================================== */}

      <div className="text-center">

        <p className="text-xs text-gray-400">
          Live economic-calendar data •
          Updated from the configured news provider.
        </p>

      </div>

      {/* ====================================================
          EVENT MODAL
      ==================================================== */}

      {selectedEvent && (

        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() =>
            setSelectedEvent(
              null
            )
          }
        >

          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="p-5 border-b border-gray-200">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <div className="flex items-center gap-2 mb-2">

                    <span className="text-sm font-bold">
                      {getEventTime(
                        selectedEvent
                      )}
                    </span>

                    <span className="text-sm font-semibold">
                      {
                        selectedEvent.currency
                      }
                    </span>

                    <ImpactBadge
                      impact={
                        selectedEvent.impact
                      }
                    />

                  </div>

                  <h2 className="text-xl font-bold text-gray-900">
                    {
                      selectedEvent.event
                    }
                  </h2>

                </div>

                <button
                  onClick={() =>
                    setSelectedEvent(
                      null
                    )
                  }
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                  ×
                </button>

              </div>

            </div>

            <div className="p-5 space-y-4">

              <p className="text-sm text-gray-600 leading-6">
                {selectedEvent.description ||
                  selectedEvent.event ||
                  "Economic calendar event."}
              </p>

              <div className="grid grid-cols-3 gap-3">

                <DetailValue
                  label="Actual"
                  value={
                    selectedEvent.actual ??
                    "—"
                  }
                />

                <DetailValue
                  label="Forecast"
                  value={
                    selectedEvent.forecast ??
                    "—"
                  }
                />

                <DetailValue
                  label="Previous"
                  value={
                    selectedEvent.previous ??
                    "—"
                  }
                />

              </div>

              <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">

                <p className="text-xs font-semibold text-violet-700">
                  Event Category
                </p>

                <p className="text-sm text-violet-900 mt-1">
                  {
                    selectedEvent.category ||
                    "Economic"
                  }
                </p>

              </div>

            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end">

              <button
                onClick={() =>
                  setSelectedEvent(
                    null
                  )
                }
                className="px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium"
              >
                Close
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

/* ============================================================
   COMPONENTS
   ============================================================ */

function ImpactBadge({
  impact,
}) {
  const safeImpact =
    impact || "Low";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${getImpactClasses(
        safeImpact
      )}`}
    >

      <span
        className={`w-2 h-2 rounded-full ${getImpactDot(
          safeImpact
        )}`}
      />

      {safeImpact.toUpperCase()}

    </span>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">

      <div className="flex items-center gap-2 text-gray-500">

        {icon}

        <span className="text-xs">
          {title}
        </span>

      </div>

      <p className="text-2xl font-bold text-gray-900 mt-3">
        {value}
      </p>

    </div>
  );
}

function MiniValue({
  label,
  value,
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-2">

      <p className="text-[10px] text-gray-400">
        {label}
      </p>

      <p className="text-xs font-semibold text-gray-700 mt-1">
        {value}
      </p>

    </div>
  );
}

function DetailValue({
  label,
  value,
}) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">

      <p className="text-xs text-gray-400">
        {label}
      </p>

      <p className="text-sm font-semibold text-gray-900 mt-1">
        {value}
      </p>

    </div>
  );
}