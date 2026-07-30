import { motion } from "framer-motion";

export default function PlanPreviewSection({

  title,

  items,

  children,

}) {

  return (

    <motion.div

      initial={{ opacity: 0, y: 15 }}

      animate={{ opacity: 1, y: 0 }}

      transition={{ duration: 0.25 }}

      className="

        bg-white

        rounded-3xl

        border

        border-gray-200

        shadow-sm

        p-7

      "

    >

      <h2

        className="

          text-xl

          font-bold

          text-gray-900

          mb-6

        "

      >

        {title}

      </h2>

      {children ? (

        children

      ) : items && items.length > 0 ? (

        <div className="space-y-4">

          {items.map((item, index) => (

            <div

            key={item.id || index}

              className="

                flex

                items-start

                gap-4

                p-4

                rounded-2xl

                bg-gray-50

                border

                border-gray-100

              "

            >

              <div

                className="

                  w-7

                  h-7

                  rounded-full

                  bg-violet-600

                  text-white

                  flex

                  items-center

                  justify-center

                  text-xs

                  font-bold

                  shrink-0

                "

              >

                {index + 1}

              </div>

              <div
  className="
    flex-1
  "
>
  <p
    className={`
      leading-7
      ${
        item.checked
          ? "line-through text-gray-400"
          : "text-gray-700"
      }
    `}
  >
    {item.text}
  </p>
</div>

            </div>

          ))}

        </div>

      ) : (

        <div

          className="

            rounded-2xl

            border-2

            border-dashed

            border-gray-200

            bg-gray-50

            py-10

            text-center

            text-gray-400

          "

        >

          No data available

        </div>

      )}

    </motion.div>

  );

}