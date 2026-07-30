import { CheckCircle2 } from "lucide-react";

export default function PreviewChecklist({

title,

items=[]

}){

return(

<div className="bg-white rounded-3xl border border-gray-200 p-7">

<h2 className="text-xl font-bold mb-5">

{title}

</h2>

{items.length===0?

<div className="text-gray-400">

No data available

</div>

:

<div className="space-y-3">

{items.map((item,index)=>(

<div

key={index}

className="flex items-center gap-3"

>

<CheckCircle2

size={18}

className="text-green-500"

/>

<div>

{item}

</div>

</div>

))}

</div>

}

</div>

)

}