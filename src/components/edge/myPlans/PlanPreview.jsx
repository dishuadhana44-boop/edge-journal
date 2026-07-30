import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Pencil,
  FileText,
  Image as ImageIcon,
} from "lucide-react";

import PlanPreviewSection from "./PlanPreviewSection";
import ImageLightbox from "./ImageLightbox";


export default function PlanPreview({

  plan,

  onBack,

  onEdit,

}) {
  const [selectedImage, setSelectedImage] = useState(null);
  if (!plan) return null;

  return (

    <motion.div

      initial={{ opacity: 0 }}

      animate={{ opacity: 1 }}

      exit={{ opacity: 0 }}

      className="

        h-full

        overflow-y-auto

        bg-[#fafafa]

      "

    >

      <div className="max-w-[1350px] mx-auto px-2 py-2">

        {/* Header */}

        <div className="flex items-center justify-between mb-4">

          <button

            onClick={onBack}

            className="

              flex

              items-center

              gap-2

              px-3

              py-2

              rounded-xl

              border

              border-gray-200

              bg-white

              hover:border-violet-500

              hover:shadow-lg

              transition-all

            "

          >

            <ArrowLeft size={18} />

            Back

          </button>

          <button

            onClick={() => onEdit(plan)}

            className="

              flex

              items-center

              gap-2

              px-3

              py-2

              rounded-xl

              bg-violet-600

              hover:bg-violet-700

              text-white

              transition

            "

          >

            <Pencil size={17} />

            Edit Plan

          </button>

        </div>

        {/* Hero Card */}

        <div

          className="

            bg-white

            rounded-3xl

            border

            border-gray-200

            p-8

            shadow-sm

            mb-3

          "

        >

          <div className="flex items-start justify-between">

            <div>

              <div

                className="

                  inline-flex

                  items-center

                  gap-2

                  px-3

                  py-1

                  rounded-full

                  bg-violet-100

                  text-violet-700

                  text-sm

                  font-semibold

                  mb-3

                "

              >

                <FileText size={16} />

                {plan.type || "Trading Plan"}

              </div>

              <h1

                className="

                  text-4xl

                  font-bold

                  text-gray-900

                "

              >

                {plan.title}

              </h1>

            </div>

          </div>

        </div>



                {/* Sections */}

                <div className="space-y-4">

<PlanPreviewSection

  title="📈 Charting Process"

  items={plan.chartingProcess}

/>

<PlanPreviewSection

  title="🎯 Entry Criteria"

  items={plan.entryCriteria}

/>

<PlanPreviewSection

  title="⚙ Entry Model"

  items={plan.entryModel}

/>

<PlanPreviewSection

  title="🛑 Trade Management"

  items={plan.managementRules}

/>

<PlanPreviewSection

  title="🚪 Exit Criteria"

  items={plan.exitCriteria}

/>

<PlanPreviewSection

  title="📝 Trading Notes"

>

  <div

    className="

      bg-gray-50

      rounded-2xl

      p-5

      leading-7

      text-gray-700

    "

  >

    {plan.notes || "No notes added."}

  </div>

</PlanPreviewSection>

<PlanPreviewSection

  title="🖼 Images"

>

<div className="grid lg:grid-cols-2 gap-8">

    <div>

    <div className="mb-4 flex items-center justify-between">

<h3 className="text-lg font-semibold">
📈 Setup Example
</h3>

<span
className="
px-3
py-1
rounded-full
bg-violet-100
text-violet-700
text-xs
font-semibold
"
>
SETUP
</span>

</div>

      {plan.setupImage ? (

<img
src={plan.entryImage}
onClick={() => setSelectedImage(plan.entryImage)}

          alt="Setup"

          className="

            w-full

            rounded-2xl

            border

          "

        />

      ) : (

        <div

          className="

            h-60

            rounded-2xl

            border-2

            border-dashed

            border-gray-200

            flex

            items-center

            justify-center

            text-gray-400

          "

        >

          <ImageIcon size={28} />

        </div>

      )}

    </div>

    <div>

    <div className="mb-4 flex items-center justify-between">

<h3 className="text-lg font-semibold">
🎯 Entry Example
</h3>

<span
className="
px-3
py-1
rounded-full
bg-green-100
text-green-700
text-xs
font-semibold
"
>
ENTRY
</span>

</div>

      {plan.entryImage ? (

<img
src={plan.entryImage}
onClick={() => setSelectedImage(plan.entryImage)}

          alt="Entry"

          className="

            w-full

            rounded-2xl

            border

          "

        />

      ) : (

        <div

          className="

            h-52

            rounded-2xl

            border-2

            border-dashed

            border-gray-200

            flex

            items-center

            justify-center

            text-gray-400

          "

        >

          <ImageIcon size={28} />

        </div>

      )}

    </div>

  </div>
 

</PlanPreviewSection>

</div>

</div>

<ImageLightbox

  open={!!selectedImage}

  image={selectedImage}

  onClose={() => setSelectedImage(null)}

/>

</motion.div>

);

}