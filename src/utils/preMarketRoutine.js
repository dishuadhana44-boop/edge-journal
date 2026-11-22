// Shared access to the daily pre-market routine completion marker.
// TradingHeader writes it, the trading entry points read it.

export const PRE_MARKET_STORAGE_KEY =
  "edgeflo_pre_market_completed_date";

export function routineDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// The stored date is the state: any other day, including a tab left open
// past midnight, means today's routine still has to be done.
export function isPreMarketRoutineCompleteToday() {
  try {
    return (
      localStorage.getItem(PRE_MARKET_STORAGE_KEY) ===
      routineDateKey()
    );
  } catch (error) {
    console.error("Failed to read pre-market status:", error);
    return false;
  }
}
