import { motion } from "framer-motion";

export default function ChartAnnotation({

image,

annotations = [],

}) {

return (

<div className="relative rounded-3xl overflow-hidden shadow-xl border bg-white">

<img

src={image}

className="w-full"

/>

{annotations.map((item,index)=>(

<motion.div

key={index}

initial={{

opacity:0,

scale:.8,

}}

animate={{

opacity:1,

scale:1,

}}

transition={{

delay:index*.15,

}}

style={{

left:item.x,

top:item.y,

}}

className="absolute"

>

<div

className="

px-3

py-2

rounded-xl

text-white

text-sm

font-semibold

shadow-xl

backdrop-blur

"

style={{

background:item.color,

}}

>

{item.label}

</div>

</motion.div>

))}

</div>

);

}