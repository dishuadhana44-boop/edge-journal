import {
    Plus,
    Star,
    Trash2,
  } from "lucide-react";

  export default function TradingAccountsSidebar({
    accounts,
    selectedAccount,
    setSelectedAccount,
    onAdd,
    onDelete,
    onSetDefault,
  }) {
  return (
    <div
      className="
      w-70
      
      pr-4
      pl-4
      
      border-r
      border-gray-200
      "
    >
      <button
        onClick={onAdd}
        className="
        w-60
        mb-6
        bg-violet-600
        hover:bg-violet-700
        text-white
        rounded-2xl
        py-3
        flex
        items-center
        justify-center
        gap-2
        text-base
        font-semibold
        shadow-lg
        hover:shadow-xl
        transition-all
        duration-300
        "
      >
        <Plus size={20} />
        Add Trading Account
      </button>

      <div className="space-y-4">
        {accounts.map((acc) => (
          <button
            key={acc.id}
            onClick={() => setSelectedAccount(acc)}
            className={`
              w-full
              rounded-2xl
              p-5
              text-left
              transition-all
              duration-300

              ${
                selectedAccount?.id === acc.id
                  ? `
                    border-2
                    border-violet-600
                    bg-violet-50
                    shadow-md
                  `
                  : `
                    border
                    border-gray-200
                    hover:border-violet-300
                    hover:bg-gray-50
                    hover:shadow-md
                  `
              }
            `}
          >
            <div className="flex justify-between items-start">

<div>
<div className="flex items-center gap-2">

<h3 className="font-semibold text-lg">
  {acc.accountName}
</h3>

{selectedAccount?.id === acc.id && (
  <div
    className="
    flex
    items-center
    gap-1
    px-2.5
    py-1
    rounded-full
    bg-emerald-50
    border
    border-emerald-200
    "
  >
    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>

    <span className="text-[11px] font-semibold text-emerald-700">
      LIVE
    </span>
  </div>
)}

</div>

<p className="text-sm text-gray-500 mt-1">
{acc.accountType}
</p>
</div>

<div className="flex items-center gap-2">

  {acc.isDefault && (
    <Star
      size={16}
      fill="#facc15"
      className="text-yellow-500"
    />
  )}

  <button
    onClick={(e) => {
      e.stopPropagation();
      onDelete(acc.id);
    }}
    className="
    w-7
    h-7
    rounded-lg
    flex
    items-center
    justify-center
    text-gray-400
    hover:bg-red-50
    hover:text-red-600
    transition
    "
  >
    <Trash2 size={15} />
  </button>

</div>

</div>

            <div className="mt-5">
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Starting Balance
              </p>

              <h4 className="text-lg font-bold mt-1">
                {acc.currency}{" "}
                {Number(acc.startingBalance || 0).toLocaleString()}
              </h4>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}