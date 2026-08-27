export function analyzeMistakes(trades = []) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return [];
  }

  const mistakeMap = {};

  trades.forEach((trade) => {
    let mistakes = trade?.mistakes;

    // Agar mistakes JSON string me saved hain
    if (typeof mistakes === "string") {
      try {
        mistakes = JSON.parse(mistakes);
      } catch {
        mistakes = [mistakes];
      }
    }

    if (!Array.isArray(mistakes)) return;

    mistakes.forEach((mistake) => {
      const name = String(mistake || "").trim();

      if (!name) return;

      if (!mistakeMap[name]) {
        mistakeMap[name] = {
          mistake: name,
          count: 0,
          pnlImpact: 0,
          trades: [],
        };
      }

      mistakeMap[name].count += 1;
      mistakeMap[name].pnlImpact += Number(trade?.pnl || 0);
      mistakeMap[name].trades.push(trade);
    });
  });

  const totalTrades = trades.length;

  return Object.values(mistakeMap)
    .map((item) => ({
      ...item,

      frequency:
        totalTrades > 0
          ? Number(((item.count / totalTrades) * 100).toFixed(1))
          : 0,

      averagePnL:
        item.count > 0
          ? Number((item.pnlImpact / item.count).toFixed(2))
          : 0,
    }))
    .sort((a, b) => b.count - a.count);
}