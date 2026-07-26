import { motion } from "framer-motion";
import {
  ArrowLeft,
  Star,
} from "lucide-react";

import PresetHeader from "./PresetHeader";
import PresetSection from "./PresetSection";
import PresetGallery from "./PresetGallery";
import ChartAnnotation from "./ChartAnnotation";
import ChartHotspots from "./ChartHotspots";
import PresetChecklist from "./PresetChecklist";
import PresetButtons from "./PresetButtons";

export default function PresetPreview({

  preset,

  onBack,

}) {

  if (!preset) return null;

  return (

    <motion.div

      initial={{ opacity: 0 }}

      animate={{ opacity: 1 }}

      exit={{ opacity: 0 }}

      className="h-full overflow-y-auto hide-scrollbar bg-[#fafafa]"

    >

      <div className="max-w-[1300px] mx-auto py-10 px-12">

        {/* Top Bar */}

        <div className="flex items-center justify-between mb-8">

          <button

            onClick={onBack}

            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-gray-200 hover:border-violet-500 hover:shadow-lg transition-all"

          >

            <ArrowLeft size={18} />

            Back

          </button>

          <button

            className="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center hover:border-yellow-400 hover:text-yellow-500 hover:shadow-lg transition-all"

          >

            <Star size={20} />

          </button>

        </div>

        {/* Header */}

        <PresetHeader preset={preset} />

        <div className="space-y-8 mt-10">

          <PresetSection

            title="📖 Definition"

            content={preset.sections.definition}

          />

          <PresetSection

            title="🎯 Purpose"

            content={preset.sections.purpose}

          />

          <PresetSection

            title="📈 Market Conditions"

            content={preset.sections.marketConditions}

          />

<PresetSection
  title="🧠 Psychology"
  content={preset.sections.psychology}
/>

<PresetSection
  title="🏦 Institutional Logic"
  content={preset.sections.institutionalLogic}
/>

<PresetSection title="📸 Chart Examples">

<PresetGallery
    images={preset.images}
/>

</PresetSection>

<PresetSection title="🎯 Annotated Chart">

    <ChartAnnotation
        image={preset.image}
        annotations={preset.annotations}
    />

</PresetSection>

<PresetSection title="🧠 Interactive Hotspots">

    <ChartHotspots
        image={preset.image}
        hotspots={preset.hotspots}
    />

</PresetSection>

<PresetSection

title="⚙ Entry Model"

content={preset.sections.entryModel}

/>

<PresetSection

title="✅ Entry Rules"

content={preset.sections.entryRules}

/>

<PresetSection
  title="🛑 Stop Loss Rules"
  content={preset.sections.stopLoss}
/>

<PresetSection
  title="❌ Invalidation Rules"
  content={preset.sections.invalidations}
/>

<PresetSection
  title="🎯 Take Profit"
  content={preset.sections.takeProfit}
/>

<PresetSection
  title="⚠ Common Mistakes"
  content={preset.sections.commonMistakes}
/>

<PresetSection title="📋 Trading Checklist">

  <PresetChecklist
    items={preset.sections.checklist}
  />

</PresetSection>

<PresetSection
  title="💡 Pro Tips"
  content={preset.sections.proTips}
/>

<PresetSection
  title="📝 Personal Notes"
  content={preset.sections.notes}
/>

<PresetButtons

    preset={preset}

    onFavorite={() => {}}

    onDuplicate={() => {}}

    onSave={() => {}}

    onShare={() => {}}

/>

        </div>

      </div>

    </motion.div>

  );

}