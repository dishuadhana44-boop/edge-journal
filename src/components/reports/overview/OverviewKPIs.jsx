import StatCard from "../shared/StatCard";

const kpis = [
    {
      title: "Net P&L",
      value: "+$8,427",
      change: "+12.6%",
      color: "text-green-600",
    },
    {
      title: "Gross Profit",
      value: "$18,240",
      change: "+5.2%",
      color: "text-green-600",
    },
    {
      title: "Gross Loss",
      value: "-$9,813",
      change: "-2.4%",
      color: "text-red-500",
    },
    {
      title: "Win Rate",
      value: "68%",
      change: "+3.8%",
      color: "text-green-600",
    },
    {
      title: "Profit Factor",
      value: "2.14",
      change: "+0.18",
      color: "text-violet-600",
    },
    {
      title: "Expectancy",
      value: "$84",
      change: "+7%",
      color: "text-green-600",
    },
    {
      title: "Average RR",
      value: "2.35R",
      change: "+0.12R",
      color: "text-blue-600",
    },
    {
      title: "Trades",
      value: "184",
      change: "+18",
      color: "text-gray-900",
    },
    {
      title: "Largest Win",
      value: "$1,940",
      change: "",
      color: "text-green-600",
    },
    {
      title: "Largest Loss",
      value: "-$820",
      change: "",
      color: "text-red-500",
    },
    {
      title: "Average Win",
      value: "$264",
      change: "",
      color: "text-green-600",
    },
    {
      title: "Average Loss",
      value: "-$124",
      change: "",
      color: "text-red-500",
    },
  ];
  
  export default function OverviewKPIs() {
    return (

        <div className="grid grid-cols-6 gap-1">
        
        <StatCard
        title="Net P&L"
        value="+$8,427"
        
        positive={true}
        color="text-green-600"
        />
        
        <StatCard
        title="Gross Profit"
        value="$18,240"
        
        positive={true}
        color="text-green-600"
        />
        
        <StatCard
        title="Gross Loss"
        value="-$9,813"
        
        positive={false}
        color="text-red-500"
        />
        
        <StatCard
        title="Win Rate"
        value="68%"
        
        positive={true}
        color="text-green-600"
        />
        
        <StatCard
        title="Profit Factor"
        value="2.14"
        
        positive={true}
        color="text-violet-600"
        />
        
        <StatCard
        title="Expectancy"
        value="$84"
        
        positive={true}
        color="text-green-600"
        />
        
        <StatCard
        title="Average RR"
        value="2.35R"
        
        positive={true}
        color="text-blue-600"
        />
        
        <StatCard
        title="Trades"
        value="184"
        color="text-gray-900"
        />
        
        <StatCard
        title="Largest Win"
        value="$1,940"
        color="text-green-600"
        />
        
        <StatCard
        title="Largest Loss"
        value="-$820"
        color="text-red-500"
        />
        
        <StatCard
        title="Average Win"
        value="$264"
        color="text-green-600"
        />
        
        <StatCard
        title="Average Loss"
        value="-$124"
        color="text-red-500"
        />
        
        </div>
        
        );
  }