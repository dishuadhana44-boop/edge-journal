import { X } from "lucide-react";

export default function PlanStatsDrawer({
  open,
  onClose,
}) {
  return (
    <>
      {/* Backdrop */}

      <div
        onClick={onClose}
        className={`
          fixed inset-0
          bg-black/30
          backdrop-blur-sm
          transition-all
          duration-300
          z-40

          ${
            open
              ? "opacity-100 visible"
              : "opacity-0 invisible"
          }
        `}
      />

      {/* Drawer */}

      <div
        className={`
          fixed

          top-0
          right-0

          h-screen

          w-[430px]

          bg-white

          shadow-2xl

          border-l

          border-gray-200

          transition-all

          duration-300

          z-50

          ${
            open
              ? "translate-x-0"
              : "translate-x-full"
          }
        `}
      >

        {/* Header */}

        <div className="flex items-center justify-between px-6 py-5 border-b">

          <div>

            <h2 className="text-xl font-bold">
              Plan Statistics
            </h2>

          

          </div>

          <button
            onClick={onClose}
            className="
              h-10
              w-10

              rounded-xl

              hover:bg-gray-100

              flex
              items-center
              justify-center
            "
          >
            <X size={20} />
          </button>

        </div>

        {/* Body */}

        <div className="p-6 space-y-6 overflow-y-auto h-[calc(100vh-90px)]">

          <div className="border rounded-2xl p-5">

            <h3 className="font-semibold">
              Overview
            </h3>

            <p className="text-gray-500 mt-2">
              Stats cards will come here...
            </p>

          </div>

          <div className="border rounded-2xl p-5">

            <h3 className="font-semibold">
              Performance
            </h3>

            <p className="text-gray-500 mt-2">
              Charts will come here...
            </p>

          </div>

          <div className="border rounded-2xl p-5">

            <h3 className="font-semibold">
              Discipline
            </h3>

            <p className="text-gray-500 mt-2">
              Rule compliance...
            </p>

          </div>

        </div>

      </div>
    </>
  );
}