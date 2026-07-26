import {
    TrendingUp,
    Target,
    DollarSign,
    Activity,
  } from "lucide-react";
  
  const sections = [
    {
      title: "Performance",
      rows: [
        ["Net Profit", "$12,540"],
        ["Gross Profit", "$18,230"],
        ["Gross Loss", "-$5,690"],
        ["Profit Factor", "3.20"],
        ["Expectancy", "$182"],
      ],
    },
  
    {
      title: "Trades",
      rows: [
        ["Total Trades", "148"],
        ["Winning Trades", "101"],
        ["Losing Trades", "47"],
        ["Win Rate", "68.2%"],
        ["Average RR", "2.4R"],
      ],
    },
  
    {
      title: "Risk",
      rows: [
        ["Average Win", "$420"],
        ["Average Loss", "-$175"],
        ["Max Win", "$1,820"],
        ["Max Loss", "-$690"],
        ["Max Drawdown", "-3.1%"],
      ],
    },
  ];
  
  export default function PerformanceTable() {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
  
        {/* Header */}
  
        <div className="flex items-center gap-3 p-6 border-b">
  
          <TrendingUp
            size={22}
            className="text-violet-600"
          />
  
          <div>
  
            <h2 className="text-xl font-bold">
              Performance Table
            </h2>
  
           
  
          </div>
  
        </div>
  
        <div className="p-6 space-y-8">
  
          {sections.map((section) => (
  
            <div key={section.title}>
  
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
                {section.title}
              </h3>
  
              <div className="space-y-2">
  
                {section.rows.map(([label, value]) => (
  
                  <div
                    key={label}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-none"
                  >
  
                    <span className="text-gray-600">
                      {label}
                    </span>
  
                    <span className="font-semibold text-gray-900">
                      {value}
                    </span>
  
                  </div>
  
                ))}
  
              </div>
  
            </div>
  
          ))}
  
        </div>
  
      </div>
    );
  }