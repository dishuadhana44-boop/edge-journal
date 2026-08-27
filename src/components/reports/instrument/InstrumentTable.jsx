import { useMemo, useState } from "react";
import { Search } from "lucide-react";

export default function InstrumentTable({ data = [] }) {
  const [search, setSearch] = useState("");

  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return data;
    }

    return data.filter((item) =>
      String(item?.instrument || "")
        .toLowerCase()
        .includes(query)
    );
  }, [data, search]);

  const formatCurrency = (value) => {
    const number = Number(value || 0);

    return `${number < 0 ? "-" : ""}$${Math.abs(
      number
    ).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    })}`;
  };

  const formatPercent = (value) => {
    const number = Number(value || 0);

    return `${number.toFixed(1)}%`;
  };

  const formatRR = (value) => {
    const number = Number(value || 0);

    return `${number.toFixed(2)}R`;
  };

  const formatProfitFactor = (value) => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return number > 0 ? "∞" : "0.00";
    }

    return number.toFixed(2);
  };

  return (
    <div className="w-full">
      {/* =========================================
          SEARCH
      ========================================= */}

      <div className="mb-5 flex items-center justify-between">
        <div className="relative w-72">
          <Search
            size={16}
            className="
              absolute
              left-3
              top-1/2
              -translate-y-1/2
              text-gray-400
            "
          />

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search Instrument..."
            className="
              h-10
              w-full
              rounded-xl
              border
              border-gray-300
              bg-white
              pl-10
              pr-4
              text-sm
              text-gray-900
              placeholder:text-gray-400
              outline-none
              transition
              focus:border-violet-500
              focus:ring-2
              focus:ring-violet-500/20
            "
          />
        </div>

        {search && (
          <span className="text-xs text-gray-500">
            {filteredData.length} result
            {filteredData.length !== 1
              ? "s"
              : ""}
          </span>
        )}
      </div>

      {/* =========================================
          TABLE
      ========================================= */}

      <div className="overflow-hidden rounded-xl border border-gray-300 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">
                  Instrument
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Market
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Trades
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Win %
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Net P&L
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Avg RR
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  PF
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredData.map((item) => {
                const pnl = Number(
                  item?.pnl || 0
                );

                const winRate = Number(
                  item?.winRate || 0
                );

                const profitFactor = Number(
                  item?.profitFactor
                );

                return (
                  <tr
                    key={item.instrument}
                    className="
                      border-b
                      border-gray-200
                      last:border-b-0
                      transition
                      hover:bg-gray-50
                    "
                  >
                    {/* INSTRUMENT */}

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="
                            flex
                            h-8
                            w-8
                            items-center
                            justify-center
                            rounded-lg
                            bg-violet-100
                            text-xs
                            font-bold
                            text-violet-700
                          "
                        >
                          {String(
                            item?.instrument || "?"
                          )
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>

                        <span className="text-sm font-semibold text-gray-900">
                          {item?.instrument ||
                            "Unknown"}
                        </span>
                      </div>
                    </td>

                    {/* MARKET */}

                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">
                        {item?.market ||
                          "Other"}
                      </span>
                    </td>

                    {/* TRADES */}

                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-gray-800">
                        {item?.trades || 0}
                      </span>
                    </td>

                    {/* WIN RATE */}

                    <td className="px-4 py-4">
                      <span
                        className={`
                          text-sm
                          font-semibold
                          ${
                            winRate >= 50
                              ? "text-green-600"
                              : "text-gray-700"
                          }
                        `}
                      >
                        {formatPercent(
                          winRate
                        )}
                      </span>
                    </td>

                    {/* P&L */}

                    <td className="px-4 py-4">
                      <span
                        className={`
                          text-sm
                          font-semibold
                          ${
                            pnl > 0
                              ? "text-green-600"
                              : pnl < 0
                                ? "text-red-500"
                                : "text-gray-600"
                          }
                        `}
                      >
                        {formatCurrency(pnl)}
                      </span>
                    </td>

                    {/* RR */}

                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-gray-700">
                        {formatRR(item?.rr)}
                      </span>
                    </td>

                    {/* PROFIT FACTOR */}

                    <td className="px-4 py-4">
                      <span
                        className={`
                          text-sm
                          font-semibold
                          ${
                            profitFactor >= 1
                              ? "text-gray-900"
                              : "text-red-500"
                          }
                        `}
                      >
                        {formatProfitFactor(
                          item?.profitFactor
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* =========================================
            EMPTY STATE
        ========================================= */}

        {filteredData.length === 0 && (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <Search
                size={18}
                className="text-gray-400"
              />
            </div>

            <p className="mt-3 text-sm font-medium text-gray-600">
              No instruments found
            </p>

            <p className="mt-1 text-xs text-gray-400">
              {search
                ? `No results for "${search}"`
                : "Add trades to see instrument analysis."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}