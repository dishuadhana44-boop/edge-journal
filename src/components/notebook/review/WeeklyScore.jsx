import { useState } from "react";
import {
Shield,
Brain,
Target,
TrendingUp,
Award,
} from "lucide-react";

export default function WeeklyScore(){

const [discipline,setDiscipline]=useState(8);
const [execution,setExecution]=useState(7);
const [psychology,setPsychology]=useState(8);
const [risk,setRisk]=useState(9);

const overall=Math.round(

(
discipline+
execution+
psychology+
risk
)/4

);

const circumference=2*Math.PI*85;

const offset=

circumference-

(overall/10)*circumference;

function grade(){

if(overall>=9) return "A+";

if(overall>=8) return "A";

if(overall>=7) return "B";

if(overall>=6) return "C";

return "D";

}

const cards=[

{
title:"Discipline",
icon:Shield,
value:discipline,
setter:setDiscipline,
},

{
title:"Execution",
icon:Target,
value:execution,
setter:setExecution,
},

{
title:"Psychology",
icon:Brain,
value:psychology,
setter:setPsychology,
},

{
title:"Risk",
icon:TrendingUp,
value:risk,
setter:setRisk,
},

];

return(

<div className="space-y-6">

{/* Overall */}

<div className="bg-white rounded-[30px] border border-gray-200 p-8">

<div className="flex items-center gap-3">

<Award className="text-purple-600"/>

<h2 className="text-2xl font-black">

Weekly Score

</h2>

</div>

<div className="flex justify-center mt-8">

<div className="relative w-52 h-52">

<svg
className="w-52 h-52 -rotate-90"
>

<circle

cx="104"

cy="104"

r="85"

stroke="#ECECEC"

strokeWidth="14"

fill="none"

/>

<circle

cx="104"

cy="104"

r="85"

stroke="url(#gradient)"

strokeWidth="14"

fill="none"

strokeLinecap="round"

strokeDasharray={circumference}

strokeDashoffset={offset}

style={{

transition:"1s",

}}

/>

<defs>

<linearGradient

id="gradient"

x1="0%"

y1="0%"

x2="100%"

y2="100%"

>

<stop

offset="0%"

stopColor="#9333EA"

/>

<stop

offset="100%"

stopColor="#7C3AED"

/>

</linearGradient>

</defs>

</svg>

<div className="absolute inset-0 flex flex-col items-center justify-center">

<h1 className="text-6xl font-black">

{overall}

</h1>

<p className="text-gray-400">

Overall

</p>

<span className="mt-2 px-4 py-1 rounded-full bg-purple-100 text-purple-700 font-bold">

{grade()}

</span>

</div>

</div>

</div>

</div>

{/* Sliders */}

{cards.map((item,index)=>{

const Icon=item.icon;

return(

<div

key={index}

className="bg-white rounded-[26px] border border-gray-200 p-6 hover:border-purple-500 hover:shadow-xl transition"

>

<div className="flex justify-between">

<div>

<p className="text-gray-400">

{item.title}

</p>

<h2 className="text-4xl font-black mt-2">

{item.value}

</h2>

</div>

<div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center">

<Icon className="text-purple-600"/>

</div>

</div>

<input

type="range"

min="0"

max="10"

value={item.value}

onChange={(e)=>

item.setter(

Number(e.target.value)

)

}

className="w-full mt-6 accent-purple-600"

/>

</div>

)

})}

</div>

)

}