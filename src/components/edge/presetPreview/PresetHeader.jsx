import { motion } from "framer-motion";
import {
  Clock3,
  Layers3,
  Signal,
} from "lucide-react";

export default function PresetHeader({

  preset,

}) {

  return (

    <motion.div

      initial={{ y: 30, opacity: 0 }}

      animate={{ y: 0, opacity: 1 }}

      transition={{

        duration: .45,

      }}

      className="rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 p-10 text-white shadow-2xl"

    >

      {/* Category */}

      <div className="flex items-center gap-3 mb-5">

        <div className="px-4 py-1 rounded-full bg-white/15 backdrop-blur border border-white/20">

          {preset.category}

        </div>

        <div className="px-4 py-1 rounded-full bg-white/15 backdrop-blur border border-white/20">

          {preset.difficulty}

        </div>

      </div>

      {/* Title */}

      <motion.h1

        initial={{ opacity:0, y:10 }}

        animate={{ opacity:1, y:0 }}

        transition={{ delay:.15 }}

        className="text-5xl font-bold tracking-tight"

      >

        {preset.title}

      </motion.h1>

      {/* Description */}

      <motion.p

        initial={{ opacity:0 }}

        animate={{ opacity:1 }}

        transition={{ delay:.25 }}

        className="mt-5 text-lg text-violet-100 leading-8 max-w-4xl"

      >

        {preset.description}

      </motion.p>

      {/* Stats */}

      <div className="flex flex-wrap gap-5 mt-10">

        {/* Category */}

        <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-5 py-4 backdrop-blur border border-white/15">

          <Layers3 size={20} />

          <div>

            <p className="text-xs text-violet-200">

              Category

            </p>

            <p className="font-semibold">

              {preset.category}

            </p>

          </div>

        </div>

        {/* Difficulty */}

        <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-5 py-4 backdrop-blur border border-white/15">

          <Signal size={20} />

          <div>

            <p className="text-xs text-violet-200">

              Difficulty

            </p>

            <p className="font-semibold">

              {preset.difficulty}

            </p>

          </div>

        </div>

        {/* Timeframes */}

        <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-5 py-4 backdrop-blur border border-white/15">

          <Clock3 size={20} />

          <div>

            <p className="text-xs text-violet-200">

              Timeframes

            </p>

            <div className="flex gap-2 mt-1 flex-wrap">

              {preset.timeframe.map((tf)=>(

                <span

                  key={tf}

                  className="px-3 py-1 rounded-full bg-white/15 text-sm"

                >

                  {tf}

                </span>

              ))}

            </div>

          </div>

        </div>

      </div>

    </motion.div>

  );

}