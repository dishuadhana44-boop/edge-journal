import { useMemo, useState } from "react";
import { Search, ArrowUpDown } from "lucide-react";

const ALLOWED_SESSIONS = [
  "London",
  "Asia",
  "New York",
];

export default function SessionTable({ data = [] }) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("netPnL");
  const [ascending, setAscending] = useState(false);

  function handleSort(field) {
    if (sortField === field) {
      setAscending((prev) => !prev);
    } else {
      setSortField(field);
      setAscending(false);
    }
  }

  const filtered = useMemo(() => {
    let rows = data.filter((item) => {
      const session = String(item?.session || "").trim();

      const isAllowed = ALLOWED_SESSIONS.some(
        (allowed) =>
          allowed.toLowerCase() ===
          session.toLowerCase()
      );

      const matchesSearch = session
        .toLowerCase()
        .includes(search.toLowerCase());

      return isAllowed && matchesSearch;
    });

    rows = [...rows].sort((a, b) => {
      const aValue = a?.[sortField];
      const bValue = b?.[sortField];

      if (
        typeof aValue === "string" ||
        typeof bValue === "string"
      ) {
        const aString = String(aValue || "");
        const bString = String(bValue || "");

        return ascending
          ? aString.localeCompare(bString)
          : bString.localeCompare(aString);
      }

      const aNumber = Number(aValue || 0);
      const bNumber = Number(bValue || 0);

      return ascending
        ? aNumber - bNumber
        : bNumber - aNumber;
    });

    return rows;
  }, [
    data,
    search,
    sortField,
    ascending,
  ]);

  return (
    <div>

      {/* SEARCH */}

      <div className="flex justify-between items-center mb-5">

        <div className="relative w-72">

          <Search
            size={16}
            className="absolute left-3 top-3 text-gray-400"
          />

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search Session..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-violet-500"
          />

        </div>

      </div>

      {/* TABLE */}

      <div className="rounded-xl border overflow-hidden">

        <table className="w-full">

          <thead className="bg-gray-50">

            <tr className="text-sm text-gray-600">

              <Header
                title="Session"
                field="session"
                onSort={handleSort}
              />

              <Header
                title="Trades"
                field="trades"
                onSort={handleSort}
              />

              <Header
                title="Win %"
                field="winRate"
                onSort={handleSort}
              />

              <Header
                title="Net P&L"
                field="netPnL"
                onSort={handleSort}
              />

              <Header
                title="Avg RR"
                field="averageRR"
                onSort={handleSort}
              />

              <Header
                title="PF"
                field="profitFactor"
                onSort={handleSort}
              />

            </tr>

          </thead>

          <tbody>

            {filtered.length > 0 ? (
              filtered.map((item, index) => {

                const pnl = Number(
                  item?.netPnL || 0
                );

                const winRate = Number(
                  item?.winRate || 0
                );

                const averageRR = Number(
                  item?.averageRR || 0
                );

                const profitFactor = Number(
                  item?.profitFactor || 0
                );

                return (
                  <tr
                    key={
                      item?.id ||
                      `${item?.session}-${index}`
                    }
                    className="border-t hover:bg-gray-50 transition"
                  >

                    {/* SESSION */}

                    <td className="px-5 py-4 font-semibold">

                      <div className="flex items-center gap-2">

                        <span>
                          {item?.icon || ""}
                        </span>

                        <span>
                          {item?.session || "-"}
                        </span>

                      </div>

                    </td>

                    {/* TRADES */}

                    <td>
                      {Number(item?.trades || 0)}
                    </td>

                    {/* WIN RATE */}

                    <td className="font-semibold text-green-600">
                      {winRate.toFixed(1)}%
                    </td>

                    {/* PNL */}

                    <td
                      className={`font-semibold ${
                        pnl >= 0
                          ? "text-green-600"
                          : "text-red-500"
                      }`}
                    >
                      {pnl < 0 ? "-" : ""}$
                      {Math.abs(pnl).toLocaleString(
                        "en-US",
                        {
                          maximumFractionDigits: 0,
                        }
                      )}
                    </td>

                    {/* RR */}

                    <td>
                      {averageRR.toFixed(2)}R
                    </td>

                    {/* PROFIT FACTOR */}

                    <td>
                      {profitFactor.toFixed(2)}
                    </td>

                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 text-center text-sm text-gray-500"
                >
                  No session data available.
                </td>
              </tr>
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}

function Header({
  title,
  field,
  onSort,
}) {
  return (
    <th
      onClick={() => onSort(field)}
      className="cursor-pointer px-5 py-3 text-left select-none hover:bg-gray-100 transition"
    >

      <div className="flex items-center gap-1">

        {title}

        <ArrowUpDown
          size={14}
          className="text-gray-400"
        />

      </div>

    </th>
  );
}