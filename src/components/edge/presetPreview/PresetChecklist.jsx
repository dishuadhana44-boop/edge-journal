import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { motion } from "framer-motion";

export default function PresetChecklist({

  items = [],

}) {

  const [checked, setChecked] = useState([]);

  function toggle(index) {

    if (checked.includes(index)) {

      setChecked(checked.filter((i) => i !== index));

    } else {

      setChecked([...checked, index]);

    }

  }

  const progress =
    items.length === 0
      ? 0
      : (checked.length / items.length) * 100;

  return (

    <div className="space-y-6">

      {/* Progress */}

      <div>

        <div className="flex justify-between mb-2">

          <p className="font-semibold text-gray-700">

            Completion

          </p>

          <p className="text-sm text-gray-500">

            {checked.length} / {items.length}

          </p>

        </div>

        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">

          <motion.div

            animate={{

              width: `${progress}%`,

            }}

            transition={{

              duration: .35,

            }}

            className="h-full bg-gradient-to-r from-violet-500 to-purple-600"

          />

        </div>

      </div>

      {/* Checklist */}

      <div className="space-y-4">

        {items.map((item, index) => {

          const active = checked.includes(index);

          return (

            <motion.div

              key={index}

              whileHover={{

                scale: 1.01,

              }}

              className={`

                rounded-2xl

                border

                p-5

                cursor-pointer

                transition-all

                duration-300

                flex

                items-center

                gap-4

                ${

                  active

                    ? "border-violet-500 bg-violet-50"

                    : "border-gray-200 bg-white"

                }

              `}

              onClick={() => toggle(index)}

            >

              {active ? (

                <CheckCircle2

                  size={26}

                  className="text-violet-600"

                />

              ) : (

                <Circle

                  size={26}

                  className="text-gray-400"

                />

              )}

              <span

                className={`

                  text-[16px]

                  ${

                    active

                      ? "line-through text-gray-400"

                      : "text-gray-700"

                  }

                `}

              >

                {item}

              </span>

            </motion.div>

          );

        })}

      </div>

    </div>

  );

}