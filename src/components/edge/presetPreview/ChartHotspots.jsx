import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function ChartHotspots({

image,

hotspots=[],

}){

const [active,setActive]=useState(null);

return(

<div className="relative rounded-3xl overflow-hidden border bg-white shadow-xl">

<img

src={image}

className="w-full select-none"

/>

{

hotspots.map((spot,index)=>(

<div

key={index}

style={{

left:spot.x,

top:spot.y,

}}

className="absolute"

>

<motion.div

whileHover={{

scale:1.2,

}}

onMouseEnter={()=>setActive(index)}

onMouseLeave={()=>setActive(null)}

className="

w-5

h-5

rounded-full

bg-violet-600

border-4

border-white

shadow-xl

cursor-pointer

"

/>

<AnimatePresence>

{

active===index&&(

<motion.div

initial={{

opacity:0,

y:10,

}}

animate={{

opacity:1,

y:0,

}}

exit={{

opacity:0,

}}

className="

absolute

top-7

left-0

w-72

rounded-2xl

bg-white

shadow-2xl

border

border-gray-200

p-5

z-50

"

>

<h3 className="font-bold text-lg mb-2">

{spot.title}

</h3>

<p className="text-gray-600 text-sm leading-6">

{spot.description}

</p>

</motion.div>

)

}

</AnimatePresence>

</div>

))

}

</div>

)

}