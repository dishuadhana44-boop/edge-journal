import { motion } from "framer-motion";

export default function PresetSection({

  title,

  content,

  children,

}) {

  return (

    <motion.div

      initial={{

        opacity:0,

        y:20,

      }}

      whileInView={{

        opacity:1,

        y:0,

      }}

      viewport={{

        once:true,

      }}

      transition={{

        duration:.35,

      }}

      whileHover={{

        y:-3,

        scale:1.01,

      }}

      className="

        group

        rounded-3xl

        bg-white

        border

        border-gray-200

        shadow-sm

        hover:shadow-2xl

        hover:border-violet-400

        transition-all

        duration-300

        overflow-hidden

      "

    >

      {/* Purple Top Line */}

      <div

        className="

          h-1

          bg-gradient-to-r

          from-violet-500

          via-purple-500

          to-indigo-500

        "

      />

      <div className="p-8">

        {/* Title */}

        <h2

          className="

            text-2xl

            font-bold

            text-gray-900

            mb-6

            group-hover:text-violet-600

            transition

          "

        >

          {title}

        </h2>

        {/* Content */}

        {children ? (

          children

        ) : (

          <p

            className="

              leading-8

              text-gray-600

              text-[16px]

              whitespace-pre-wrap

            "

          >

            {content || "Coming Soon..."}

          </p>

        )}

      </div>

    </motion.div>

  );

}