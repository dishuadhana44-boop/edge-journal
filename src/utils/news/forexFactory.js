const API_URL = "/api/forex-calendar";

export async function fetchForexNews() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error("Unable to load Forex calendar");
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Invalid calendar response");
  }

  return data.map((item, index) => ({
    id: `${item.date || ""}-${item.title || item.event || ""}-${index}`,

    date: item.date || null,

    currency:
      item.country ||
      item.currency ||
      "—",

    impact: normalizeImpact(item.impact),

    event:
      item.title ||
      item.event ||
      "Economic Event",

    actual:
      item.actual || "—",

    forecast:
      item.forecast || "—",

    previous:
      item.previous || "—",

    timestamp:
      item.timestamp || null,
  }));
}

function normalizeImpact(value) {
  const impact = String(value || "").toLowerCase();

  if (impact.includes("high")) {
    return "HIGH";
  }

  if (
    impact.includes("medium") ||
    impact.includes("med")
  ) {
    return "MEDIUM";
  }

  if (impact.includes("low")) {
    return "LOW";
  }

  return "LOW";
}