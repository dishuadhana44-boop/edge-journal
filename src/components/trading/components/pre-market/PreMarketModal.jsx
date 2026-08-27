import { useState } from "react";
import { X, Check } from "lucide-react";

const ROUTINE_ITEMS = [
  {
    id: "trade-plan",
    title: "Review Trade Plan",
    description:
      "Review your setup, bias, entry and invalidation.",
  },
  {
    id: "charts",
    title: "Review Charts",
    description:
      "Check market structure, levels and potential setups.",
  },
  {
    id: "meditate",
    title: "Meditate",
    description:
      "Take a few minutes to clear your mind before trading.",
  },
  {
    id: "calendar",
    title: "Check Economic Calendar",
    description:
      "Review today's important economic events and news.",
  },
];

export default function PreMarketModal({
  onClose,
  onComplete,
}) {
  const [completed, setCompleted] = useState([]);

  const toggleItem = (id) => {
    setCompleted((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const progress = Math.round(
    (completed.length / ROUTINE_ITEMS.length) * 100
  );

  const routineCompleted =
    completed.length === ROUTINE_ITEMS.length;

  return (
    <div
      className="
        fixed
        inset-0
        z-[9999]
        flex
        items-center
        justify-center
        bg-black/40
        backdrop-blur-sm
        p-4
      "
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* =====================================================
          MODAL
      ===================================================== */}

      <div
        className="
          w-full
          max-w-lg
          max-h-[85vh]
          flex
          flex-col
          rounded-2xl
          bg-white
          border
          border-gray-200
          shadow-2xl
          overflow-hidden
        "
      >

        {/* ===================================================
            HEADER
        =================================================== */}

        <div className="px-6 py-5 border-b border-gray-100">

          <div className="flex items-start justify-between gap-4">

            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Pre-Market Routine
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Prepare yourself before starting the trading session.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="
                w-8
                h-8
                rounded-lg
                flex
                items-center
                justify-center
                text-gray-400
                hover:bg-gray-100
                hover:text-gray-700
                transition
              "
            >
              <X size={17} />
            </button>

          </div>


          {/* =================================================
              PROGRESS
          ================================================= */}

          <div className="mt-5">

            <div className="flex justify-between mb-2">

              <span className="text-[11px] text-gray-500">
                Routine Progress
              </span>

              <span className="text-[11px] font-semibold text-violet-600">
                {completed.length}/{ROUTINE_ITEMS.length}
              </span>

            </div>

            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">

              <div
                className="
                  h-full
                  rounded-full
                  bg-violet-500
                  transition-all
                  duration-300
                "
                style={{
                  width: `${progress}%`,
                }}
              />

            </div>

            <div className="mt-1 text-right text-[10px] text-gray-400">
              {progress}% complete
            </div>

          </div>

        </div>


        {/* ===================================================
            CHECKLIST
        =================================================== */}

        <div className="flex-1 overflow-y-auto p-6 space-y-2">

          {ROUTINE_ITEMS.map((item) => {

            const checked = completed.includes(item.id);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleItem(item.id)}
                className={`
                  w-full
                  flex
                  items-start
                  gap-3
                  p-4
                  rounded-xl
                  border
                  text-left
                  transition-all
                  duration-200

                  ${
                    checked
                      ? "bg-violet-50 border-violet-200"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }
                `}
              >

                {/* CHECKBOX */}

                <div
                  className={`
                    mt-0.5
                    w-5
                    h-5
                    rounded-md
                    border
                    flex
                    items-center
                    justify-center
                    shrink-0

                    ${
                      checked
                        ? "bg-violet-500 border-violet-500 text-white"
                        : "border-gray-300"
                    }
                  `}
                >
                  {checked && (
                    <Check
                      size={13}
                      strokeWidth={3}
                    />
                  )}
                </div>


                {/* TEXT */}

                <div>

                  <div
                    className={`
                      text-sm
                      font-medium

                      ${
                        checked
                          ? "text-violet-700"
                          : "text-gray-800"
                      }
                    `}
                  >
                    {item.title}
                  </div>

                  <div className="mt-1 text-[11px] text-gray-500">
                    {item.description}
                  </div>

                </div>

              </button>
            );
          })}

        </div>


        {/* ===================================================
            FOOTER
        =================================================== */}

        <div className="px-6 py-4 border-t border-gray-100">

          {routineCompleted ? (

            <div className="space-y-3">

              {/* SUCCESS MESSAGE */}

              <div
                className="
                  rounded-xl
                  bg-emerald-50
                  border
                  border-emerald-100
                  px-4
                  py-3
                  text-center
                "
              >

                <div className="text-sm font-semibold text-emerald-700">
                  ✓ You're ready to trade
                </div>

                <div className="text-[11px] text-emerald-600 mt-1">
                  Pre-market routine completed.
                </div>

              </div>


              {/* START TRADING */}

              <button
                type="button"
                onClick={onComplete}
                className="
                  w-full
                  h-10
                  rounded-xl
                  bg-emerald-500
                  hover:bg-emerald-600
                  text-white
                  text-sm
                  font-semibold
                  transition-all
                  duration-200
                  hover:-translate-y-[1px]
                  hover:shadow-md
                "
              >
                Start Trading
              </button>

            </div>

          ) : (

            <p className="text-center text-[11px] text-gray-400">
              Complete all checklist items before starting the session.
            </p>

          )}

        </div>

      </div>
    </div>
  );
}