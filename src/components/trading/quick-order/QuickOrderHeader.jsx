import {
  ChevronDown,
  X,
  Grip
 } from "lucide-react";

export default function QuickOrderHeader({
  setQuickOrderOpen,
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">

      <div className="flex items-center gap-2">

        <img
          src="https://flagcdn.com/w40/eu.png"
          className="w-5 h-5 rounded-full"
        />

        <span className="font-semibold">
          EURUSD
        </span>

        <ChevronDown size={16} />

      </div>

      <div className="flex items-center gap-1">

<div
  className="
    cursor-grab

    rounded-lg

    p-1.5

    hover:bg-gray-100

    transition
  "
>
  <Grip
    size={15}
    className="text-gray-400"
  />
</div>

<button
  onClick={() => setQuickOrderOpen(false)}
  className="
    rounded-lg

    p-1.5

    hover:bg-gray-100

    transition
  "
>
  <X
    size={16}
    className="text-gray-500"
  />
</button>

</div>

    </div>
  );
}