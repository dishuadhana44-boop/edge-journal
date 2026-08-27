const API_URL =
  "https://api.tradingeconomics.com/calendar/country/United%20States?c=guest:guest";

function normalizeImpact(importance) {
  const value = String(importance || "").toLowerCase();

  if (
    value.includes("high") ||
    value === "3" ||
    value === "3.0"
  ) {
    return "High";
  }

  if (
    value.includes("medium") ||
    value === "2" ||
    value === "2.0"
  ) {
    return "Medium";
  }

  return "Low";
}

function normalizeEvent(item, index) {
  const date = item?.Date
    ? new Date(item.Date)
    : null;

  return {
    id:
      item?.CalendarId ??
      item?.ID ??
      `${item?.Country}-${item?.Event}-${index}`,

    time: date
      ? date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",

    currency:
      item?.Currency ||
      item?.currency ||
      "—",

    impact: normalizeImpact(
      item?.Importance ??
        item?.importance
    ),

    event:
      item?.Event ||
      item?.event ||
      "Economic Event",

    actual:
      item?.Actual ??
      item?.actual ??
      "—",

    forecast:
      item?.Forecast ??
      item?.forecast ??
      "—",

    previous:
      item?.Previous ??
      item?.previous ??
      "—",

    category:
      item?.Category ||
      item?.category ||
      "Economic",

    description:
      item?.Event ||
      "Economic calendar event.",
  };
}

export async function fetchForexNews() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(
      `News API error: ${response.status}`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error(
      "Invalid news API response"
    );
  }

  return data.map(normalizeEvent);
}