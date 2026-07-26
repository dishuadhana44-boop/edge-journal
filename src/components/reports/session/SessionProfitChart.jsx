import {

    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    
    } from "recharts";
    
    const COLORS = [
    
    "#2563EB",
    "#7C3AED",
    "#22C55E",
    "#EF4444",
    
    ];
    
    export default function SessionProfitChart({
    
    data,
    
    }) {
    
    return (
    
    <div className="bg-white rounded-xl border border-gray-200 p-5">
    
    <h3 className="text-lg font-semibold mb-5">
    
    Profit by Session
    
    </h3>
    
    <ResponsiveContainer
    width="100%"
    height={320}
    >
    
    <BarChart
    
    data={data}
    
    layout="vertical"
    
    margin={{
    
    top:10,
    right:20,
    left:20,
    bottom:10,
    
    }}
    
    >
    
    <CartesianGrid
    
    stroke="#F1F5F9"
    
    horizontal={false}
    
    />
    
    <XAxis
    
    type="number"
    
    tickFormatter={(v)=>`$${v/1000}k`}
    
    />
    
    <YAxis
    
    type="category"
    
    dataKey="session"
    
    width={90}
    
    />
    
    <Tooltip
    
    formatter={(value)=>[
    `$${value.toLocaleString()}`,
    "Net P&L",
    ]}
    
    />
    
    <Bar
    
    dataKey="netPnL"
    
    radius={[8,8,8,8]}
    
    >
    
    {data.map((item,index)=>(
    
    <Cell
    
    key={index}
    
    fill={COLORS[index]}
    
    />
    
    ))}
    
    </Bar>
    
    </BarChart>
    
    </ResponsiveContainer>
    
    </div>
    
    );
    
    }