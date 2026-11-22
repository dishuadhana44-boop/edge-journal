// Every entry here maps to a widget that is actually rendered on the dashboard,
// so no checkbox can exist without a corresponding section.
export const DASHBOARD_SECTIONS = [
  // ----------------------------------------------------------
  // PERFORMANCE
  // ----------------------------------------------------------
  {
    key: "accountOverview",
    label: "Account Balance",
    group: "Performance",
    default: true,
  },
  { key: "netPnl", label: "Net P&L", group: "Performance", default: true },
  { key: "winRate", label: "Win Rate", group: "Performance", default: true },
  { key: "avgRisk", label: "Average R", group: "Performance", default: true },
  {
    key: "profitFactor",
    label: "Profit Factor",
    group: "Performance",
    default: true,
  },
  {
    key: "expectancy",
    label: "Expectancy",
    group: "Performance",
    default: true,
  },
  {
    key: "totalTrades",
    label: "Total Trades",
    group: "Performance",
    default: true,
  },

  // ----------------------------------------------------------
  // P&L CURVES
  // ----------------------------------------------------------
  {
    key: "equityCurve",
    label: "Equity Curve",
    group: "P&L Curves",
    default: true,
  },
  {
    key: "dailyPnlCurve",
    label: "Daily P&L Curve",
    group: "P&L Curves",
    default: false,
  },
  {
    key: "weeklyPnlCurve",
    label: "Weekly P&L Curve",
    group: "P&L Curves",
    default: false,
  },
  {
    key: "monthlyPnlCurve",
    label: "Monthly P&L Curve",
    group: "P&L Curves",
    default: false,
  },
  {
    key: "cumulativePnlCurve",
    label: "Cumulative P&L Curve",
    group: "P&L Curves",
    default: false,
  },
  {
    key: "drawdownCurve",
    label: "Drawdown Curve",
    group: "P&L Curves",
    default: false,
  },
  {
    key: "drawdownPercent",
    label: "Drawdown Percentage",
    group: "P&L Curves",
    default: false,
  },

  // ----------------------------------------------------------
  // TRADE ANALYTICS
  // ----------------------------------------------------------
  {
    key: "openPositions",
    label: "Open Positions",
    group: "Trade Analytics",
    default: true,
  },
  {
    key: "recentTrades",
    label: "Recent Trades",
    group: "Trade Analytics",
    default: false,
  },
  {
    key: "longShortPerformance",
    label: "Long vs Short Performance",
    group: "Trade Analytics",
    default: false,
  },
  {
    key: "symbolPerformance",
    label: "Performance by Symbol",
    group: "Trade Analytics",
    default: false,
  },
  {
    key: "weekdayPerformance",
    label: "Performance by Weekday",
    group: "Trade Analytics",
    default: false,
  },
  {
    key: "discipline",
    label: "Discipline Breakdown",
    group: "Trade Analytics",
    default: true,
  },
];

export const SECTION_GROUPS = DASHBOARD_SECTIONS.reduce((groups, section) => {
  if (!groups[section.group]) groups[section.group] = [];

  groups[section.group].push(section);

  return groups;
}, {});

export const DEFAULT_SECTIONS = DASHBOARD_SECTIONS.reduce((acc, section) => {
  acc[section.key] = section.default;
  return acc;
}, {});
