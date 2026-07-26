import { useState } from "react";
import { Search } from "lucide-react";

export default function InstrumentTable({ data }) {

const [search,setSearch]=useState("");

const filtered=data.filter(item=>

item.instrument
.toLowerCase()
.includes(search.toLowerCase())

);

return(

<div>

<div className="flex items-center justify-between mb-5">

<div className="relative w-72">

<Search
size={16}
className="absolute left-3 top-3 text-gray-400"
/>

<input

value={search}

onChange={(e)=>setSearch(e.target.value)}

placeholder="Search Instrument..."

className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-violet-500"

/>

</div>

</div>

<div className="overflow-hidden rounded-xl border">

<table className="w-full">

<thead className="bg-gray-50">

<tr className="text-left text-sm text-gray-600">

<th className="px-5 py-3">Instrument</th>

<th>Market</th>

<th>Trades</th>

<th>Win %</th>

<th>Net P&L</th>

<th>Avg RR</th>

<th>PF</th>

</tr>

</thead>

<tbody>

{filtered.map((item)=>(

<tr

key={item.id}

className="border-t hover:bg-gray-50 transition"

>

<td className="px-5 py-4 font-semibold">

{item.instrument}

</td>

<td>

{item.market}

</td>

<td>

{item.trades}

</td>

<td className="font-semibold text-green-600">

{item.winRate}%

</td>

<td
className={`font-semibold ${
item.pnl>=0
?"text-green-600"
:"text-red-500"
}`}
>

${item.pnl.toLocaleString()}

</td>

<td>

{item.rr}R

</td>

<td>

{item.profitFactor}

</td>

</tr>

))}

</tbody>

</table>

</div>

</div>

)

}