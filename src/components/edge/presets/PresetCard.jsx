import {
  ArrowRight,
  BookOpen,
} from "lucide-react";

export default function PresetCard({

  preset,

  onPreview,

}) {

  return (

    <button

      onClick={() => onPreview(preset)}

      className="

        group

        bg-white

        rounded-2xl

        overflow-hidden

        border

        border-gray-200

        hover:border-violet-500

        hover:shadow-xl

        hover:-translate-y-1

        transition-all

        duration-300

        text-left

      "

    >

      {/* Thumbnail */}

      <div

        className="

          h-48

          bg-gradient-to-br

          from-violet-100

          to-violet-50

          flex

          items-center

          justify-center

        "

      >

        <div

          className="

            w-24

            h-24

            rounded-2xl

            bg-violet-600

            flex

            items-center

            justify-center

            text-white

            text-3xl

            font-bold

            shadow-xl

            group-hover:scale-110

            transition

          "

        >

          {preset.title.charAt(0)}

        </div>

      </div>

      {/* Content */}

      <div className="p-5">

        <div className="flex items-center justify-between">

          <span

            className="

              text-xs

              bg-violet-100

              text-violet-700

              px-3

              py-1

              rounded-full

            "

          >

            {preset.category}

          </span>

          <BookOpen

            size={17}

            className="text-gray-400"

          />

        </div>

        <h3

          className="

            mt-4

            text-lg

            font-bold

            text-gray-900

          "

        >

          {preset.title}

        </h3>

        <p

          className="

            mt-2

            text-sm

            text-gray-500

            leading-6

          "

        >

          {preset.description}

        </p>

        <div

          className="

            mt-6

            flex

            items-center

            justify-between

          "

        >

          <span

            className="

              text-violet-600

              font-semibold

            "

          >

            Preview

          </span>

          <ArrowRight

            size={18}

            className="

              text-violet-600

              group-hover:translate-x-1

              transition

            "

          />

        </div>

      </div>

    </button>

  );

}