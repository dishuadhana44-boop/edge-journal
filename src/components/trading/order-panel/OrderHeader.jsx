import { ChevronDown, X } from "lucide-react";

export default function OrderHeader({ setOrderOpen }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">

      <div className="flex items-center gap-2">
        <img
          src="https://flagcdn.com/w40/eu.png"
          alt="EUR"
          className="w-5 h-5 rounded-full"
        />

        <span className="font-semibold text-[15px] text-gray-900">
          EURUSD
        </span>

        <ChevronDown
          size={16}
          className="text-gray-400"
        />
      </div>

      <button
        onClick={() => setOrderOpen(false)}
        className="
          w-8
          h-8
          flex
          items-center
          justify-center
          rounded-lg
          hover:bg-gray-100
          transition
        "
      >
        <X size={18} />
      </button>

    </div>
  );
}