export function calculatePnL(
  side,
  entry,
  current,
  lots
) {
  const pipValue = 10;
  const pipSize = 0.0001;

  const normalizedSide =
    String(side).toUpperCase();

  const pips =
    normalizedSide === "BUY"
      ? (Number(current) - Number(entry)) / pipSize
      : (Number(entry) - Number(current)) / pipSize;

  return pips * pipValue * Number(lots || 0);
}