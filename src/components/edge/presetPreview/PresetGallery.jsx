import { useState } from "react";

import {

ChevronLeft,

ChevronRight,

Expand,

X,

} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";

export default function PresetGallery({

images = [],

}) {

const [index, setIndex] = useState(0);

const [fullscreen, setFullscreen] = useState(false);

if (images.length === 0)

return (

<div className="rounded-3xl border border-dashed border-gray-300 p-20 text-center text-gray-400">

No Chart Examples Yet

</div>

);

function next() {

setIndex((prev) =>

prev === images.length - 1 ? 0 : prev + 1

);

}

function prev() {

setIndex((prev) =>

prev === 0 ? images.length - 1 : prev - 1

);

}

return (

<>

<motion.div

whileHover={{ scale: 1.01 }}

className="relative rounded-3xl overflow-hidden bg-white border shadow-lg"

>

<img

src={images[index]}

alt="Preset"

className="w-full h-[500px] object-cover"

/>

{/* Expand */}

<button

onClick={() => setFullscreen(true)}

className="absolute top-5 right-5 bg-white/80 backdrop-blur rounded-xl p-3 hover:bg-white"

>

<Expand size={20} />

</button>

{/* Left */}

<button

onClick={prev}

className="absolute left-5 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-3 shadow"

>

<ChevronLeft />

</button>

{/* Right */}

<button

onClick={next}

className="absolute right-5 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-3 shadow"

>

<ChevronRight />

</button>

{/* Counter */}

<div className="absolute bottom-5 right-5 bg-black/50 backdrop-blur text-white px-4 py-2 rounded-full">

{index + 1} / {images.length}

</div>

</motion.div>

<AnimatePresence>

{fullscreen && (

<motion.div

initial={{ opacity:0 }}

animate={{ opacity:1 }}

exit={{ opacity:0 }}

className="fixed inset-0 bg-black/90 z-[999] flex items-center justify-center"

>

<button

onClick={()=>setFullscreen(false)}

className="absolute top-10 right-10 text-white"

>

<X size={35}/>

</button>

<img

src={images[index]}

className="max-w-[90%] max-h-[90%] rounded-2xl"

/>

</motion.div>

)}

</AnimatePresence>

</>

);

}