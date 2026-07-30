import { useState } from "react";
import {
Smile,
Frown,
Flame,
Brain,
Zap,
Shield,
Heart,
Moon,
Sun,
Coffee,
AlertTriangle,
CheckCircle2,
} from "lucide-react";

export default function WeeklyPsychology() {

const emotions = [

{ label:"Calm", icon:Smile },

{ label:"Confident", icon:Shield },

{ label:"Focused", icon:Brain },

{ label:"Patient", icon:CheckCircle2 },

{ label:"FOMO", icon:Zap },

{ label:"Fear", icon:AlertTriangle },

{ label:"Greedy", icon:Flame },

{ label:"Revenge", icon:Frown },

{ label:"Happy", icon:Heart },

{ label:"Tired", icon:Moon },

{ label:"Energetic", icon:Sun },

{ label:"Distracted", icon:Coffee },

];

const [selected,setSelected]=useState("Calm");

const [intensity,setIntensity]=useState(7);

const [notes,setNotes]=useState("");

return(

<div className="bg-white rounded-[30px] border border-gray-200 p-8">

{/* Header */}

<div className="flex items-center justify-between">

<div>

<h2 className="text-3xl font-black">

Trading Psychology

</h2>



</div>

<div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center">

<Brain className="text-white"/>

</div>

</div>

{/* Emotion Grid */}

<div className="grid grid-cols-4 gap-4 mt-8">

{emotions.map((item,index)=>{

const Icon=item.icon;

const active=selected===item.label;

return(

<button

key={index}

onClick={()=>setSelected(item.label)}

className={`

rounded-2xl

border

p-5

transition-all

duration-300

hover:-translate-y-1

${active

? "border-purple-500 bg-purple-50 shadow-lg"

: "border-gray-200 hover:border-purple-400"}

`}

>

<div className="flex flex-col items-center">

<div

className={`

w-14

h-14

rounded-2xl

flex

items-center

justify-center

${active

? "bg-purple-600 text-white"

: "bg-gray-100 text-gray-600"}

`}

>

<Icon size={24}/>

</div>

<p className="mt-4 font-semibold">

{item.label}

</p>

</div>

</button>

)

})}

</div>

{/* Intensity */}

<div className="mt-10">

<div className="flex justify-between">

<h3 className="font-bold">

Emotion Intensity

</h3>

<span className="font-black text-purple-600">

{intensity}/10

</span>

</div>

<input

type="range"

min="1"

max="10"

value={intensity}

onChange={(e)=>setIntensity(Number(e.target.value))}

className="w-full mt-5 accent-purple-600"

/>

</div>

{/* Reflection */}

<div className="mt-10">

<h3 className="font-bold">

Reflection

</h3>

<textarea

value={notes}

onChange={(e)=>setNotes(e.target.value)}

placeholder="Write about your emotions during trading..."

className="mt-4 w-full min-h-[140px] rounded-2xl border border-gray-200 p-5 outline-none focus:border-purple-500 resize-none"

/>

</div>

{/* AI Insight */}

<div className="mt-8 rounded-3xl bg-gradient-to-r from-purple-50 to-violet-50 p-6 border border-purple-100">

<h3 className="font-bold text-purple-700">

AI Insight

</h3>

<p className="mt-3 text-gray-600 leading-8">

Your dominant emotion is

<strong> {selected}</strong>.

Intensity level is

<strong> {intensity}/10</strong>.

Maintaining emotional consistency is one of the strongest indicators of long-term trading success.

</p>

</div>

</div>

)

}