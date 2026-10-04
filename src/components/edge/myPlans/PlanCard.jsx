import { motion } from "framer-motion";
import { useState } from "react";
import DeletePlanModal from "./DeletePlanModal";

import {
  Eye,
  Pencil,
  Trash2,
  FileText,
  Check,
} from "lucide-react";

export default function PlanCard({
  plan,
  onPreview,
  onEdit,
  onDelete,
  onSelect,
}) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [planToDelete, setPlanToDelete] = useState(null);

  const isSelected =
    localStorage.getItem("selectedEdgePlan") &&
    (() => {
      try {
        const selected = JSON.parse(
          localStorage.getItem("selectedEdgePlan")
        );

        return String(selected?.id) === String(plan?.id);
      } catch {
        return false;
      }
    })();

  return (
    <>
      <motion.div
        whileHover={{
          y: -4,
          scale: 1.01,
        }}
        transition={{
          duration: 0.18,
        }}
        className={`
          w-[360px]
          bg-white
          rounded-3xl
          border
          overflow-hidden
          transition-all
          duration-300
          ${
            isSelected
              ? "border-emerald-500 shadow-lg shadow-emerald-100"
              : "border-gray-200 hover:border-violet-500 hover:shadow-2xl"
          }
        `}
      >
        <div className="p-7">

          {/* HEADER */}
          <div className="flex items-center justify-between mb-7">
            <div
              className="
                w-10
                h-10
                rounded-xl
                bg-violet-100
                flex
                items-center
                justify-center
              "
            >
              <FileText
                size={20}
                className="text-violet-600"
              />
            </div>

            <div
              className="
                px-2
                py-1
                rounded-full
                bg-violet-100
                text-violet-700
                text-xs
                font-semibold
              "
            >
              {plan.type || "Trading Plan"}
            </div>
          </div>

          {/* PLAN NAME */}
          <h2
            className="
              mt-3
              text-xl
              font-bold
              text-gray-900
            "
          >
            {plan.title}
          </h2>

          {/* SELECT PLAN */}
          <button
            type="button"
            onClick={() => onSelect?.(plan)}
            className={`
              mt-6
              w-full
              h-10
              rounded-xl
              flex
              items-center
              justify-center
              gap-2
              text-sm
              font-semibold
              transition
              ${
                isSelected
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : "bg-violet-600 text-white hover:bg-violet-700"
              }
            `}
          >
            <Check size={16} />

            {isSelected
              ? "Selected Plan"
              : "Select Plan"}
          </button>

          {/* ACTION BUTTONS */}
          <div
            className="
              mt-6
              pt-5
              border-t
              border-gray-100
              flex
              items-center
              justify-evenly
            "
          >
            {/* PREVIEW */}
            <button
              type="button"
              onClick={() => onPreview(plan)}
              className="
                flex
                items-center
                gap-1.5
                text-violet-600
                hover:text-violet-700
                text-sm
                font-semibold
                hover:scale-105
                duration-200
                transition
              "
            >
              <Eye size={16} />
              <span>Preview</span>
            </button>

            {/* EDIT */}
            <button
              type="button"
              onClick={() => onEdit(plan)}
              className="
                flex
                items-center
                gap-1.5
                text-blue-600
                hover:text-blue-700
                text-sm
                font-semibold
                hover:scale-105
                duration-200
                transition
              "
            >
              <Pencil size={16} />
              <span>Edit</span>
            </button>

            {/* DELETE */}
            <button
              type="button"
              onClick={() => {
                setPlanToDelete(plan);
                setShowDeleteModal(true);
              }}
              className="
                flex
                items-center
                gap-1.5
                text-red-600
                hover:text-red-700
                text-sm
                font-semibold
                hover:scale-105
                duration-200
                transition
              "
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </motion.div>

      {showDeleteModal && (
        <DeletePlanModal
          planTitle={planToDelete?.title}
          onCancel={() => {
            setShowDeleteModal(false);
            setPlanToDelete(null);
          }}
          onConfirm={() => {
            onDelete(planToDelete);
            setShowDeleteModal(false);
            setPlanToDelete(null);
          }}
        />
      )}
    </>
  );
}