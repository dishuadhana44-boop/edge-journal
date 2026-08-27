import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  Star,
  Bell,
  ClipboardList,
  CheckCircle2,
  ChevronDown,
  X,
} from "lucide-react";

const DEFAULT_WATCHLIST = [
  {
    symbol: "EURUSD",
    flag: "🇪🇺",
    price: "1.153724",
    change: "+0.02%",
    positive: true,
  },
  {
    symbol: "GBPJPY",
    flag: "🇯🇵",
    price: "207.83850",
    change: "-1.32%",
    positive: false,
  },
  {
    symbol: "GBPUSD",
    flag: "🇬🇧",
    price: "1.364340",
    change: "+0.02%",
    positive: true,
  },
];

export default function TradingSidePanel({
  onExpand,
}) {
  const [activeTab, setActiveTab] = useState("watchlist");
  const [search, setSearch] = useState("");
  const [watchlist, setWatchlist] = useState(DEFAULT_WATCHLIST);

  const filteredWatchlist = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return watchlist;

    return watchlist.filter((item) =>
      item.symbol.toLowerCase().includes(query)
    );
  }, [search, watchlist]);

  const toggleFavorite = (symbol) => {
    setWatchlist((prev) =>
      prev.map((item) =>
        item.symbol === symbol
          ? { ...item, favorite: !item.favorite }
          : item
      )
    );
  };

  return (
    <aside
      className="
        h-full
        w-[285px]
        min-w-[285px]
        bg-white
        border-l
        border-gray-200
        flex
        flex-col
        overflow-hidden
      "
    >
      {/* =========================================
          TOP TRADING STATUS
      ========================================= */}

      <div className="px-4 pt-3 pb-3 border-b border-gray-100">

        {/* Trades Today */}

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-1.5">

            <span className="text-[11px] font-medium text-gray-700">
              Trades Today:
            </span>

            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-200" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-200" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-200" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-200" />
            </div>

          </div>

          <span className="text-[10px] font-semibold text-gray-600">
            1/5
          </span>

        </div>


        {/* Trading Window */}

        <div className="mt-3">

          <div className="flex items-center justify-between">

            <span className="text-[10px] text-gray-500">
              Trading Window
            </span>

            <span className="
              px-1.5
              py-0.5
              rounded-md
              bg-violet-50
              text-violet-600
              text-[8px]
              font-semibold
            ">
              Open
            </span>

          </div>

          <div className="mt-1 text-[10px] font-medium text-gray-700">
            10:30 - 01:30 (UTC)
          </div>

        </div>


        {/* Today's P&L */}

        <div className="mt-3 flex items-center justify-between">

          <span className="text-[10px] text-gray-500">
            Today's Net P&L
          </span>

          <span className="text-[11px] font-semibold text-red-500">
            -$11.27
          </span>

        </div>


        {/* Risk */}

        <div className="grid grid-cols-2 gap-3 mt-3">

          <div>
            <div className="text-[9px] text-gray-400">
              Max Loss
            </div>

            <div className="mt-0.5 text-[10px] font-semibold text-gray-700">
              $100K
            </div>
          </div>

          <div>
            <div className="text-[9px] text-gray-400">
              Daily Target
            </div>

            <div className="mt-0.5 text-[10px] font-semibold text-gray-700">
              $50K
            </div>
          </div>

        </div>


        {/* Rule status */}

        <div className="
          mt-3
          flex
          items-center
          gap-2
          px-2.5
          py-2
          rounded-lg
          bg-emerald-50
          border
          border-emerald-100
        ">

          <CheckCircle2
            size={12}
            className="text-emerald-500"
          />

          <span className="text-[9px] font-medium text-emerald-700">
            No rule violations today
          </span>

        </div>

      </div>


      {/* =========================================
          TABS
      ========================================= */}

      <div className="
        h-10
        px-2
        border-b
        border-gray-100
        flex
        items-center
      ">

        <button
          onClick={() => setActiveTab("watchlist")}
          className={`
            flex-1
            h-full
            text-[9px]
            font-medium
            transition
            ${
              activeTab === "watchlist"
                ? "text-violet-600 border-b-2 border-violet-500"
                : "text-gray-400 hover:text-gray-700"
            }
          `}
        >
          Watchlist
        </button>

        <button
          onClick={() => setActiveTab("alerts")}
          className={`
            flex-1
            h-full
            flex
            items-center
            justify-center
            gap-1
            text-[9px]
            font-medium
            transition
            ${
              activeTab === "alerts"
                ? "text-violet-600 border-b-2 border-violet-500"
                : "text-gray-400 hover:text-gray-700"
            }
          `}
        >
          <Bell size={10} />
          Alerts
        </button>

        <button
          onClick={() => setActiveTab("plans")}
          className={`
            flex-1
            h-full
            flex
            items-center
            justify-center
            gap-1
            text-[9px]
            font-medium
            transition
            ${
              activeTab === "plans"
                ? "text-violet-600 border-b-2 border-violet-500"
                : "text-gray-400 hover:text-gray-700"
            }
          `}
        >
          <ClipboardList size={10} />
          Trade Plans
        </button>

      </div>


      {/* =========================================
          CONTENT
      ========================================= */}

      <div className="flex-1 overflow-y-auto">

        {/* WATCHLIST */}

        {activeTab === "watchlist" && (

          <div className="p-2.5">

            {/* Search */}

            <div className="flex items-center gap-1.5">

              <div className="
                flex
                items-center
                flex-1
                h-8
                px-2
                rounded-lg
                border
                border-gray-200
                bg-gray-50
              ">

                <Search
                  size={12}
                  className="text-gray-400 shrink-0"
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  className="
                    w-full
                    ml-1.5
                    bg-transparent
                    outline-none
                    text-[10px]
                    text-gray-700
                    placeholder:text-gray-400
                  "
                />

                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="text-gray-400 hover:text-gray-700"
                  >
                    <X size={10} />
                  </button>
                )}

              </div>


              <button
                className="
                  w-8
                  h-8
                  rounded-lg
                  bg-violet-500
                  hover:bg-violet-600
                  text-white
                  flex
                  items-center
                  justify-center
                  transition
                "
                title="Add instrument"
              >
                <Plus size={14} />
              </button>

            </div>


            {/* Table Header */}

            <div className="
              grid
              grid-cols-[1fr_70px_50px]
              px-2
              mt-3
              mb-1
            ">

              <span className="text-[8px] text-gray-400">
                Instrument
              </span>

              <span className="text-[8px] text-gray-400 text-right">
                Last
              </span>

              <span className="text-[8px] text-gray-400 text-right">
                Chg
              </span>

            </div>


            {/* Instruments */}

            <div className="space-y-0.5">

              {filteredWatchlist.map((item) => (

                <div
                  key={item.symbol}
                  className="
                    grid
                    grid-cols-[1fr_70px_50px]
                    items-center
                    px-2
                    py-2.5
                    rounded-lg
                    hover:bg-gray-50
                    transition
                    group
                  "
                >

                  <div className="flex items-center gap-1.5 min-w-0">

                    <span className="text-[11px]">
                      {item.flag}
                    </span>

                    <span className="
                      text-[10px]
                      font-medium
                      text-gray-700
                    ">
                      {item.symbol}
                    </span>

                  </div>


                  <span className="
                    text-[9px]
                    text-gray-600
                    text-right
                  ">
                    {item.price}
                  </span>


                  <div className="flex items-center justify-end gap-1">

                    <span
                      className={`
                        text-[8px]
                        font-medium
                        ${
                          item.positive
                            ? "text-emerald-500"
                            : "text-red-500"
                        }
                      `}
                    >
                      {item.change}
                    </span>

                    <button
                      onClick={() =>
                        toggleFavorite(item.symbol)
                      }
                      className="
                        opacity-0
                        group-hover:opacity-100
                        transition
                      "
                    >
                      <Star
                        size={9}
                        className={
                          item.favorite
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        }
                      />
                    </button>

                  </div>

                </div>

              ))}

            </div>

          </div>

        )}


        {/* ALERTS */}

        {activeTab === "alerts" && (

          <div className="p-4">

            <div className="
              rounded-xl
              border
              border-gray-100
              bg-gray-50
              p-5
              text-center
            ">

              <Bell
                size={20}
                className="mx-auto text-gray-300"
              />

              <p className="mt-2 text-[10px] font-medium text-gray-600">
                No active alerts
              </p>

              <p className="mt-1 text-[9px] text-gray-400">
                Create price alerts from the chart.
              </p>

            </div>

          </div>

        )}


        {/* TRADE PLANS */}

        {activeTab === "plans" && (

          <div className="p-4">

            <div className="
              rounded-xl
              border
              border-gray-100
              bg-gray-50
              p-5
              text-center
            ">

              <ClipboardList
                size={20}
                className="mx-auto text-gray-300"
              />

              <p className="mt-2 text-[10px] font-medium text-gray-600">
                No active trade plans
              </p>

              <p className="mt-1 text-[9px] text-gray-400">
                Create a plan before entering a trade.
              </p>

            </div>

          </div>

        )}

      </div>


      {/* =========================================
          EXPAND ORDER PANEL
      ========================================= */}

      <button
        onClick={onExpand}
        className="
          absolute
          right-0
          top-[50%]
          -translate-y-1/2
          translate-x-1/2
          z-20
          w-7
          h-12
          rounded-l-lg
          bg-white
          border
          border-gray-200
          shadow-sm
          flex
          items-center
          justify-center
          text-gray-500
          hover:text-gray-900
          hover:bg-gray-50
          transition
        "
        title="Expand Order Panel"
      >
        <ChevronDown
          size={14}
          className="rotate-90"
        />
      </button>

    </aside>
  );
}