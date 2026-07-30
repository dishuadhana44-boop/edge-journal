import { motion } from "framer-motion";
import { useState } from "react";
import DeletePlanModal from "./DeletePlanModal";
import {

  Eye,

  Pencil,

  Trash2,

  FileText,

  Clock3,

} from "lucide-react";

export default function PlanCard({

  plan,

  onPreview,

  onEdit,

  onDelete,

}) {

  const [showDeleteModal, setShowDeleteModal] = useState(false);
const [planToDelete, setPlanToDelete] = useState(null);

return (
  <>
    <motion.div

      whileHover={{

        y: -4,

        scale: 1.01,

      }}

      transition={{

        duration: .18,

      }}

      className="
     w-[360px]
      
      bg-white
      
      rounded-3xl
      
      border
      
      border-gray-200
      
      hover:border-violet-500
      
      hover:shadow-2xl
      
      overflow-hidden
      
      transition-all
      
      duration-300
      
      "

    >
        <div className="p-7">

        <div className="flex items-center justify-between mb-7">

<div

className="

w-10

h-10

rounded-xl

bg-violet-100

flex

items-center

justify-center

"

>

<FileText

size={20}

className="text-violet-600"

/>

</div>

<div

className="

px-2

py-1

rounded-full

bg-violet-100

text-violet-700

text-xs

font-semibold

"

>

{plan.type || "Trading Plan"}

</div>

</div>

<h2

className="

mt-3

text-xl

font-bold

text-gray-900

"

>

{plan.title}

</h2>





{/* Action Buttons */}

<div

className="

mt-6

pt-5

border-t

border-gray-100

flex

items-center

justify-evenly

"

>

<button

onClick={() => onPreview(plan)}

className="

flex

items-center

gap-1.5

text-violet-600

hover:text-violet-700

text-sm

font-semibold

hover:scale-105

duration-200

transition

"

>

<Eye size={16} />

<span>Preview</span>

</button>

<button

onClick={() => onEdit(plan)}

className="

flex

items-center

gap-1.5

text-blue-600

hover:text-blue-700

text-sm

font-semibold

hover:scale-105

duration-200

transition

"

>

<Pencil size={16} />

<span>Edit</span>

</button>

<button

onClick={() => {
  setPlanToDelete(plan);
  setShowDeleteModal(true);
}}

className="

flex

items-center

gap-1.5

text-red-600

hover:text-red-700

text-sm

font-semibold

hover:scale-105

duration-200

transition

"

>

<Trash2 size={16} />

<span>Delete</span>

</button>

</div>

</div>

</motion.div>

{showDeleteModal && (
  <DeletePlanModal
    planTitle={planToDelete?.title}

    onCancel={() => {
      setShowDeleteModal(false);
      setPlanToDelete(null);
    }}

    onConfirm={() => {
      onDelete(planToDelete);

      setShowDeleteModal(false);

      setPlanToDelete(null);
    }}
  />
)}
</>

);

}