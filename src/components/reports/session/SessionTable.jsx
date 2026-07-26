import { useMemo, useState } from "react";
import { Search, ArrowUpDown } from "lucide-react";

export default function SessionTable({ data }) {

const [search,setSearch]=useState("");

const [sortField,setSortField]=useState("netPnL");

const [ascending,setAscending]=useState(false);

function handleSort(field){

if(sortField===field){

setAscending(!ascending);

}else{

setSortField(field);

setAscending(false);

}

}

const filtered=useMemo(()=>{

let rows=data.filter(item=>

item.session
.toLowerCase()
.includes(search.toLowerCase())

);

rows.sort((a,b)=>{

if(typeof a[sortField]==="string"){

return ascending
?a[sortField].localeCompare(b[sortField])
:b[sortField].localeCompare(a[sortField]);

}

return ascending
?a[sortField]-b[sortField]
:b[sortField]-a[sortField];

});

return rows;

},[data,search,sortField,ascending]);

return(

<div>

<div className="flex justify-between items-center mb-5">

<div className="relative w-72">

<Search
size={16}
className="absolute left-3 top-3 text-gray-400"
/>

<input

value={search}

onChange={(e)=>setSearch(e.target.value)}

placeholder="Search Session..."

className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-violet-500"

/>

</div>

</div>

<div className="rounded-xl border overflow-hidden">

<table className="w-full">

<thead className="bg-gray-50">

<tr className="text-sm text-gray-600">

<Header
title="Session"
field="session"
onSort={handleSort}
/>

<Header
title="Trades"
field="trades"
onSort={handleSort}
/>

<Header
title="Win %"
field="winRate"
onSort={handleSort}
/>

<Header
title="Net P&L"
field="netPnL"
onSort={handleSort}
/>

<Header
title="Avg RR"
field="averageRR"
onSort={handleSort}
/>

<Header
title="PF"
field="profitFactor"
onSort={handleSort}
/>

</tr>

</thead>

<tbody>

{filtered.map(item=>(

<tr
key={item.id}
className="border-t hover:bg-gray-50 transition"
>

<td className="px-5 py-4 font-semibold">

<div className="flex items-center gap-2">

<span>{item.icon}</span>

<span>{item.session}</span>

</div>

</td>

<td>{item.trades}</td>

<td className="font-semibold text-green-600">

{item.winRate.toFixed(1)}%

</td>

<td
className={`font-semibold ${
item.netPnL>=0
?"text-green-600"
:"text-red-500"
}`}
>

${item.netPnL.toLocaleString()}

</td>

<td>

{item.averageRR}R

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

);

}

function Header({

title,

field,

onSort,

}){

return(

<th

onClick={()=>onSort(field)}

className="cursor-pointer px-5 py-3 text-left"

>

<div className="flex items-center gap-1">

{title}

<ArrowUpDown size={14}/>

</div>

</th>

);

}