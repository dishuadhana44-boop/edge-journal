import { ChevronDown, X } from "lucide-react";
import { useMarket } from "../../../context/MarketContext";

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

  const { symbol } = useMarket();

  const currentSymbol = symbol || "EURUSD";

  const info =
    SYMBOL_INFO[currentSymbol] || SYMBOL_INFO.EURUSD;

  return (
    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">

      {/* SYMBOL */}

      <div className="flex items-center gap-2">

        <img
          src={info.icon}
          alt={info.alt}
          className="w-5 h-5 rounded-full object-cover"
        />

        <span className="font-semibold text-[15px] text-gray-900">
          {currentSymbol}
        </span>

        <ChevronDown
          size={16}
          className="text-gray-400"
        />

      </div>


      {/* CLOSE */}

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