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
  

      <div
        role="list"
        aria-label="Trading accounts"
        className="space-y-4"
      >
        {accounts.map((acc) => (
          <div
            key={acc.id}
            role="listitem"
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
                  `
              }
            `}
          >
            <div className="flex justify-between items-start">

<div>
<div className="flex items-center gap-2">

<h3 className="font-semibold text-lg">
  {/* The button sits inside the heading, never around it: a button may not
      contain flow content, and this one's only content is the name. */}
  <button
    type="button"
    aria-label={`Select ${acc.accountName}`}
    aria-pressed={selectedAccount?.id === acc.id}
    className="px-1 py-0.5 hover:text-violet-600"
    onClick={(e) => {
      e.stopPropagation();

      setSelectedAccount(acc);
    }}
  >
    {acc.accountName}
  </button>
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

  <button
    type="button"
    aria-label={`Set ${acc.accountName} as default`}
    aria-pressed={acc.isDefault}
    onClick={(e) => {
      e.stopPropagation();
      onSetDefault(acc.id);
    }}
    onKeyDown={(e) => {
      e.stopPropagation();

      if (e.key === "Enter") {
        // Cancels the click the browser would fire itself, so Enter activates
        // exactly once, from here.
        e.preventDefault();

        if (e.repeat) {
          return;
        }

        onSetDefault(acc.id);

        return;
      }

      if (e.key === " ") {
        // Cancels both the page scroll and the click the browser would fire on
        // keyup; Space activates from onKeyUp, like a real button press.
        e.preventDefault();

        return;
      }
    }}
    onKeyUp={(e) => {
      e.stopPropagation();

      if (e.key === " ") {
        e.preventDefault();

        onSetDefault(acc.id);
      }
    }}
    className="
    w-7
    h-7
    rounded-lg
    flex
    items-center
    justify-center
    hover:bg-yellow-50
    transition
    "
  >
    <Star
      size={16}
      fill={
        acc.isDefault
          ? "#facc15"
          : "none"
      }
      className={
        acc.isDefault
          ? "text-yellow-500"
          : "text-gray-300"
      }
    />
  </button>

  <button
    type="button"
    aria-label={`Delete ${acc.accountName}`}
    onClick={(e) => {
      e.stopPropagation();
      onDelete(acc.id);
    }}
    onKeyDown={(e) => {
      e.stopPropagation();
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
          </div>
        ))}
      </div>
    </div>
  );
}