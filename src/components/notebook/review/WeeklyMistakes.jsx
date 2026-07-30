import { useState } from "react";
import {
AlertTriangle,
ShieldAlert,
TrendingDown,
CheckCircle2,
} from "lucide-react";

export default function WeeklyMistakes() {

const rules = [

"Early Entry",

"Late Entry",

"FOMO Trade",

"Revenge Trade",

"No Confirmation",

"Over Trading",

"Oversized Position",

"Moved Stop Loss",

"Didn't Follow Plan",

"Poor Risk Management",

];

const [selected,setSelected]=useState([]);

function toggle(rule){

if(selected.includes(rule)){

setSelected(

selected.filter((r)=>r!==rule)

);

}else{

setSelected([...selected,rule]);

}

}

const count=selected.length;

let severity="Low";

let colour="green";

if(count>=3){

severity="Medium";

colour="yellow";

}

if(count>=6){

severity="High";

colour="red";

}

return(

<div className="bg-white rounded-[30px] border border-gray-200 p-8">

{/* Header */}

<div className="flex justify-between items-center">

<div>

<h2 className="text-3xl font-black">

Rule Violations

</h2>

<p className="text-gray-500 mt-2">

Track mistakes honestly to improve faster.

</p>

</div>

<div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">

<ShieldAlert className="text-white"/>

</div>

</div>

{/* Summary */}

<div className="grid grid-cols-3 gap-5 mt-8">

<div className="rounded-2xl border border-gray-200 p-5">

<p className="text-gray-400">

Mistakes

</p>

<h2 className="text-4xl font-black mt-2">

{count}

</h2>

</div>

<div className="rounded-2xl border border-gray-200 p-5">

<p className="text-gray-400">

Severity

</p>

<h2

className={`

text-3xl

font-black

mt-2

${colour==="green"

?"text-green-500"

:colour==="yellow"

?"text-yellow-500"

:"text-red-500"}

`}

>

{severity}

</h2>

</div>

<div className="rounded-2xl border border-gray-200 p-5">

<p className="text-gray-400">

Improvement

</p>

<h2 className="text-3xl font-black text-purple-600 mt-2">

{Math.max(0,100-count*10)}%

</h2>

</div>

</div>

{/* Rules */}

<div className="grid grid-cols-2 gap-4 mt-8">

{rules.map((rule,index)=>{

const active=selected.includes(rule);

return(

<button

key={index}

onClick={()=>toggle(rule)}

className={`

rounded-2xl

border

p-5

flex

justify-between

items-center

transition-all

duration-300

hover:-translate-y-1

${active

?"border-red-400 bg-red-50"

:"border-gray-200 hover:border-purple-400"}

`}

>

<span className="font-medium">

{rule}

</span>

{active

?<AlertTriangle

className="text-red-500"

/>

:<CheckCircle2

className="text-gray-300"

/>

}

</button>

)

})}

</div>

{/* Most Common */}

<div className="mt-8 rounded-3xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 p-6">

<h3 className="font-bold text-red-600">

Most Common Issue

</h3>

<p className="mt-3 text-gray-600 leading-8">

{count===0

?"Excellent discipline this week. No rule violations recorded."

:selected[0]}

</p>

</div>

</div>

)

}