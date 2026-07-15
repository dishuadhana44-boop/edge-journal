import {
    Shield,
    Clock3,
    BarChart3,
    Pencil,
  } from "lucide-react";
  
  function Card({ title, icon: Icon, children }) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
  
        <div className="flex items-center justify-between mb-4">
  
          <div className="flex items-center gap-2">
  
            <Icon size={16} className="text-gray-500" />
  
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {title}
            </span>
  
          </div>
  
          <button className="hover:bg-gray-100 rounded-lg p-1">
            <Pencil size={14} />
          </button>
  
        </div>
  
        {children}
  
      </div>
    );
  }
  
  function EdgeRightPanel() {
    return (
  
      <div className="w-[230px] bg-[#F7F7FB] border-l border-gray-200 p-5 overflow-y-auto">
  
        {/* Plan Stats */}
  
        <Card
          title="Plan Stats"
          icon={BarChart3}
        >
  
          <div className="space-y-2">
  
            <Row label="Trades" value="23" />
  
            <Row label="Win Rate" value="73.9%" />
  
            <Row label="Net P&L" value="+$10,586" green />
  
            <Row label="Avg RR" value="3.4R" />
  
          </div>
  
        </Card>
  
        {/* Risk */}
  
        <div className="mt-3">
  
          <Card
            title="Risk Controls"
            icon={Shield}
          >
  
            <div className="space-y-2">
  
              <Row label="Risk %" value="0.5%" />
  
              <Row label="Max Loss" value="$300" />
  
              <Row label="Daily Loss" value="$1000" />
  
              <Row label="Max Drawdown" value="10%" />
  
            </div>
  
          </Card>
  
        </div>
  
        {/* Window */}
  
        <div className="mt-2">
  
          <Card
            title="Trading Window"
            icon={Clock3}
          >
  
            <div className="text-center">
  
              <p className="text-2xl font-bold">
                08:00 - 17:00
              </p>
  
              <p className="text-sm text-gray-500 mt-2">
                UTC
              </p>
  
            </div>
  
          </Card>
  
        </div>
  
      </div>
  
    );
  }
  
  function Row({
    label,
    value,
    green,
  }) {
    return (
  
      <div className="flex justify-between items-center">
  
        <span className="text-sm text-gray-500">
  
          {label}
  
        </span>
  
        <span
          className={`font-semibold ${
            green
              ? "text-green-600"
              : "text-gray-900"
          }`}
        >
  
          {value}
  
        </span>
  
      </div>
  
    );
  }
  
  export default EdgeRightPanel;