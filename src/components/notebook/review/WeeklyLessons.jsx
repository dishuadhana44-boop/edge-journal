import { useState } from "react";
import {
Lightbulb,
Plus,
Trash2,
Sparkles,
} from "lucide-react";

export default function WeeklyLessons(){

const [lessons,setLessons]=useState([

{
id:1,
text:"",
}

]);

function updateLesson(id,value){

setLessons(

lessons.map((lesson)=>

lesson.id===id

?{

...lesson,

text:value,

}

:lesson

)

);

}

function addLesson(){

setLessons([

...lessons,

{

id:Date.now(),

text:"",

},

]);

}

function deleteLesson(id){

setLessons(

lessons.filter(

(lesson)=>lesson.id!==id

)

);

}

const completed=

lessons.filter(

(l)=>l.text.trim()!==''

).length;

return (

  <div
  className="
  bg-white
  rounded-[32px]
  border
  border-gray-200
  shadow-sm
  hover:shadow-xl
  transition-all
  duration-500
  overflow-hidden
  "
  >
  
  {/* Header */}
  
  <div className="flex items-center justify-between p-10 border-b border-gray-100">
  
  <div className="flex items-center gap-5">
  
  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
  
  <Lightbulb className="w-8 h-8 text-white"/>
  
  </div>
  
  <div>
  
  <p className="uppercase tracking-[0.35em] text-xs font-bold text-purple-600">
  
  Weekly Lessons
  
  </p>
  
  <h2 className="text-4xl font-black mt-2">
  
  Lessons Learned
  
  </h2>
  
 
  
  </div>
  
  </div>
  
  <button
  onClick={addLesson}
  className="
  w-12
  h-12
  rounded-3xl
  bg-gradient-to-r
  from-purple-600
  to-violet-500
  text-white
  flex
  items-center
  justify-center
  shadow-lg
  hover:scale-110
  hover:rotate-90
  transition-all
  duration-500
  "
  >
  
  <Plus size={24}/>
  
  </button>
  
  </div>
  
  {/* Statistics */}
  
  <div className="grid grid-cols-2 gap-6 p-8">
  
  <div className="rounded-3xl bg-gradient-to-br from-purple-50 to-white border border-purple-100 p-8">
  
  <p className="text-gray-500 text-sm">
  
  Completed Lessons
  
  </p>
  
  <h2 className="text-5xl font-black mt-3 text-purple-600">
  
  {completed}
  
  </h2>
  
  </div>
  
  <div className="rounded-3xl bg-gradient-to-br from-blue-50 to-white border border-blue-100 p-8">
  
  <p className="text-gray-500 text-sm">
  
  Total Cards
  
  </p>
  
  <h2 className="text-5xl font-black mt-3">
  
  {lessons.length}
  
  </h2>
  
  </div>
  
  </div>
  
  {/* Lesson Cards */}
  
  <div className="space-y-8 px-6 pb-8">
  
  {lessons.map((lesson,index)=>(
  
  <div
  key={lesson.id}
  className="
  rounded-[30px]
  border
  border-gray-200
  hover:border-purple-500
  hover:shadow-xl
  transition-all
  duration-500
  p-8
  bg-white
  "
  >
  
  <div className="flex items-center justify-between mb-2">
  
  <div className="flex items-center gap-4">

<div
className="
w-14
h-14
rounded-2xl
bg-gradient-to-br
from-purple-600
to-violet-500
text-white
flex
items-center
justify-center
font-black
text-xl
shadow-lg
"
>

{index+1}

</div>

<div>

<h3 className="text-2xl font-black">

Lesson #{index+1}

</h3>

<p className="text-gray-400 mt-1">

Weekly Reflection

</p>

</div>

</div>

  <button
  onClick={()=>deleteLesson(lesson.id)}
  className="
  w-12
  h-12
  rounded-2xl
  bg-red-50
  hover:bg-red-100
  text-red-500
  flex
  items-center
  justify-center
  transition
  "
  >
  
  <Trash2 size={20}/>
  
  </button>
  
  </div>

  <textarea
value={lesson.text}
onChange={(e)=>updateLesson(lesson.id,e.target.value)}
rows={5}
placeholder="Write your biggest lesson from this week...

• What happened?

• What did you learn?

• How will you improve next week?"
className="
w-full
rounded-3xl
border
border-gray-200
bg-[#fafafa]
p-6
text-lg
leading-8
resize-none
outline-none
transition-all
duration-300
focus:border-purple-500
focus:bg-white
focus:shadow-[0_0_0_5px_rgba(124,58,237,.12)]
"
/>

{lesson.text === "" && (

<p className="mt-5 text-sm text-gray-800 animate-pulse">

  💡 Tip: Great traders document WHY they entered,
  not only WHAT happened.

</p>

)}

</div>

))}

<div className="mt-8">

<div className="flex justify-between text-sm mb-3">

<span className="text-gray-500">

Completion

</span>

<span className="font-bold text-purple-600">

{Math.round((completed/lessons.length)*100)||0}%

</span>

</div>

<div className="h-3 bg-gray-200 rounded-full overflow-hidden">

<div

className="h-full bg-gradient-to-r from-purple-600 to-violet-500 rounded-full transition-all duration-700"

style={{

width:`${Math.round((completed/lessons.length)*100)||0}%`

}}



></div>

</div>

</div>

</div>



{/* AI Insight */}

<div className="mt-8 rounded-[26px] bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-100 p-6">

<div className="flex items-center gap-3">

<Sparkles className="text-purple-600"/>

<h3 className="font-bold text-purple-700">

AI Key Takeaway

</h3>

</div>

<p className="mt-4 leading-8 text-gray-600">

Your biggest lesson will appear here once AI Review is connected.
This section will summarize recurring mistakes, strengths,
and the most important improvement for next week.

</p>

</div>

</div>

)

}