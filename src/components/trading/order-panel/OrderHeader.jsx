import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Search } from "lucide-react";
import { useMarket } from "../../../context/MarketContext";

const SYMBOLS = [
  "EURUSD",
  "GBPUSD",
  "GBPJPY",
  "USDJPY",
  "USDCHF",
  "AUDUSD",
  "USDCAD",
  "NZDUSD",
  "XAUUSD",
];

const SYMBOL_INFO = {
  EURUSD: {
    icon: "https://flagcdn.com/w40/eu.png",
    alt: "EUR",
  },

  GBPUSD: {
    icon: "https://flagcdn.com/w40/gb.png",
    alt: "GBP",
  },

  GBPJPY: {
    icon: "https://flagcdn.com/w40/gb.png",
    alt: "GBP",
  },

  USDJPY: {
    icon: "https://flagcdn.com/w40/us.png",
    alt: "USD",
  },

  USDCHF: {
    icon: "https://flagcdn.com/w40/us.png",
    alt: "USD",
  },

  AUDUSD: {
    icon: "https://flagcdn.com/w40/au.png",
    alt: "AUD",
  },

  USDCAD: {
    icon: "https://flagcdn.com/w40/us.png",
    alt: "USD",
  },

  NZDUSD: {
    icon: "https://flagcdn.com/w40/nz.png",
    alt: "NZD",
  },

  XAUUSD: {
    icon: "https://flagcdn.com/w40/us.png",
    alt: "XAU",
  },
};

export default function OrderHeader({ setOrderOpen }) {
  const { symbol, setSymbol } = useMarket();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");

  const dropdownRef = useRef(null);

  const currentSymbol = String(symbol || "EURUSD")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  const info = SYMBOL_INFO[currentSymbol] || {
    icon: "https://flagcdn.com/w40/eu.png",
    alt: currentSymbol,
  };

  const filteredSymbols = SYMBOLS.filter((item) =>
    item.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  const handleSymbolChange = (newSymbol) => {
    console.log("🔄 Symbol changed:", newSymbol);

    setSymbol(newSymbol);

    setDropdownOpen(false);
    setSearch("");
  };

  return (
    <div
      className="relative flex items-center justify-between border-b border-gray-200 px-4 py-2"
      ref={dropdownRef}
    >
      {/* SYMBOL SELECTOR */}

      <button
        type="button"
        onClick={() =>
          setDropdownOpen((prev) => !prev)
        }
        className="
          flex
          items-center
          gap-2
          rounded-lg
          px-2
          py-1.5
          hover:bg-gray-100
          transition
        "
      >
        <img
          key={currentSymbol}
          src={info.icon}
          alt={info.alt}
          className="w-5 h-5 rounded-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />

        <span className="font-semibold text-[15px] text-gray-900">
          {currentSymbol}
        </span>

        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform ${
            dropdownOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* SYMBOL DROPDOWN */}

      {dropdownOpen && (
        <div
          className="
            absolute
            top-[55px]
            left-3
            z-[100]
            w-[230px]
            rounded-xl
            border
            border-gray-200
            bg-white
            shadow-xl
            overflow-hidden
          "
        >
          {/* SEARCH */}

          <div className="p-3 border-b border-gray-100">
            <div
              className="
                flex
                items-center
                gap-2
                bg-gray-50
                rounded-lg
                px-3
                py-2
              "
            >
              <Search
                size={15}
                className="text-gray-400"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search symbol..."
                autoFocus
                className="
                  w-full
                  bg-transparent
                  outline-none
                  text-sm
                  text-gray-700
                  placeholder:text-gray-400
                "
              />
            </div>
          </div>

          {/* SYMBOL LIST */}

          <div className="max-h-[280px] overflow-y-auto p-2">
            {filteredSymbols.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() =>
                  handleSymbolChange(item)
                }
                className={`
                  w-full
                  flex
                  items-center
                  justify-between
                  px-3
                  py-2.5
                  rounded-lg
                  text-sm
                  transition
                  ${
                    item === currentSymbol
                      ? "bg-violet-50 text-violet-700 font-semibold"
                      : "text-gray-700 hover:bg-gray-50"
                  }
                `}
              >
                <span>{item}</span>

                {item === currentSymbol && (
                  <span className="text-[10px]">
                    ACTIVE
                  </span>
                )}
              </button>
            ))}

            {filteredSymbols.length === 0 && (
              <div className="py-6 text-center text-sm text-gray-400">
                No symbols found
              </div>
            )}
          </div>
        </div>
      )}

      {/* CLOSE BUTTON */}

      <button
        type="button"
        onClick={() => setOrderOpen?.(false)}
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