import { useState } from "react";
import {
Plus,
Trash2,
Check,
Calendar,
Flag,
} from "lucide-react";

export default function WeeklyActionPlan(){

const [task,setTask]=useState("");

const [tasks,setTasks]=useState([]);

function addTask(){

if(!task.trim()) return;

setTasks([
...tasks,
{
id:Date.now(),
title:task,
priority:"Medium",
done:false,
}
]);

setTask("");

}

function toggle(id){

setTasks(

tasks.map((t)=>

t.id===id

?{

...t,

done:!t.done,

}

:t

)

);

}

function remove(id){

setTasks(

tasks.filter((t)=>t.id!==id)

);

}

function changePriority(id,value){

setTasks(

tasks.map((t)=>

t.id===id

?{

...t,

priority:value,

}

:t

)

);

}

const completed=tasks.filter(t=>t.done).length;

const progress=

tasks.length===0

?0

:Math.round(

completed/tasks.length*100

);

return(

<div className="bg-white rounded-[30px] border border-gray-200 p-8">

<div className="flex items-center justify-between">

<div>

<h2 className="text-3xl font-black">

Next Week Action Plan

</h2>




</div>

<div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center">

<Calendar className="text-white"/>

</div>

</div>

<div className="mt-8">

<div className="flex justify-between">

<span>Progress</span>

<strong>{progress}%</strong>

</div>

<div className="mt-3 h-3 rounded-full bg-gray-100 overflow-hidden">

<div

className="h-full bg-gradient-to-r from-purple-500 to-violet-500 transition-all duration-500"

style={{width:`${progress}%`}}

/>

</div>

</div>

<div className="flex gap-3 mt-8">

<input

value={task}

onChange={(e)=>setTask(e.target.value)}

placeholder="Add Action..."

className="flex-1 rounded-2xl border border-gray-200 px-5 py-4 outline-none focus:border-purple-500"

/>

<button

onClick={addTask}

className="w-14 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center"

>

<Plus/>

</button>

</div>

<div className="space-y-4 mt-8">

{tasks.map((item)=>(

<div

key={item.id}

className="border rounded-2xl p-5 hover:border-purple-500 transition"

>

<div className="flex justify-between">

<div

className="flex items-center gap-4 cursor-pointer"

onClick={()=>toggle(item.id)}

>

<div

className={`

w-7

h-7

rounded-full

flex

items-center

justify-center

${item.done

?"bg-green-500"

:"border-2 border-gray-300"}

`}

>

{item.done&&

<Check

size={15}

className="text-white"

/>

}

</div>

<span

className={`

${item.done

?"line-through text-gray-400"

:"font-medium"}

`}

>

{item.title}

</span>

</div>

<button

onClick={()=>remove(item.id)}

className="text-red-500"

>

<Trash2 size={18}/>

</button>

</div>

<div className="mt-5 flex items-center gap-3">

<Flag

size={18}

className="text-purple-600"

/>

<select

value={item.priority}

onChange={(e)=>

changePriority(

item.id,

e.target.value

)

}

className="border rounded-xl px-3 py-2"

>

<option>High</option>

<option>Medium</option>

<option>Low</option>

</select>

</div>

</div>

))}

</div>

</div>

);

}