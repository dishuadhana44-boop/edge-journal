import { ArrowRight } from "lucide-react";

export default function TemplateCard({
  title,
  description,
  badge,
  icon,
  onClick,
}) {

  return (

    <button
      onClick={onClick}
      className="
      group
      bg-white
      rounded-3xl
      border
      border-gray-200
      hover:border-purple-500
      hover:shadow-2xl
      transition-all
      duration-300
      overflow-hidden
      text-left
      w-full
      "
    >

      {/* Top */}

      <div className="h-44 bg-gradient-to-b from-purple-50 to-white flex items-center justify-center">

        <div
          className="
          w-28
          h-28
          rounded-3xl
          bg-gradient-to-br
          from-purple-600
          to-violet-500
          flex
          items-center
          justify-center
          shadow-xl
          group-hover:scale-110
          transition
          duration-300
          "
        >
          <span className="text-4xl font-bold text-white">

            {icon}

          </span>

        </div>

      </div>

      {/* Bottom */}

      <div className="p-6">

        <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-600 text-xs font-medium">

          {badge}

        </span>

        <h3 className="mt-4 text-xl font-bold">

          {title}

        </h3>

        <p className="mt-3 text-gray-500">

          {description}

        </p>

        <div className="mt-8 flex items-center justify-between">

          <span className="text-purple-600 font-semibold">

            Open

          </span>

          <ArrowRight
            className="
            text-purple-600
            group-hover:translate-x-2
            transition-all
            duration-300
            "
          />

        </div>

      </div>

    </button>

  );

}