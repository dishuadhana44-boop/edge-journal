import { useMemo, useState } from "react";
import { Search, ArrowUpDown } from "lucide-react";

export default function PlanTable({ data = [] }) {
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

  const filteredData = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    const rows = data.filter((item) =>
      String(item?.plan || "")
        .toLowerCase()
        .includes(searchValue)
    );

    return [...rows].sort((a, b) => {
      const aValue = a?.[sortField];
      const bValue = b?.[sortField];

      // String sorting
      if (
        typeof aValue === "string" ||
        typeof bValue === "string"
      ) {
        const first = String(aValue || "");
        const second = String(bValue || "");

        return ascending
          ? first.localeCompare(second)
          : second.localeCompare(first);
      }

      // Numeric sorting
      const first = Number(aValue || 0);
      const second = Number(bValue || 0);

      return ascending
        ? first - second
        : second - first;
    });
  }, [data, search, sortField, ascending]);

  return (
    <div>

      {/* SEARCH */}
      <div className="flex items-center justify-between mb-5">

        <div className="relative w-72">

          <Search
            size={16}
            className="absolute left-3 top-3 text-gray-400"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Plan..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-violet-500 outline-none"
          />

        </div>

      </div>

      {/* TABLE */}
      <div className="rounded-xl border overflow-hidden">

        <table className="w-full">

          <thead className="bg-gray-50">

            <tr className="text-sm text-gray-600">

              <Header
                title="Plan"
                field="plan"
                onSort={handleSort}
              />

              <th className="py-3 px-5 text-left">
                Category
              </th>

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
                title="RR"
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

            {filteredData.length > 0 ? (
              filteredData.map((item, index) => (

                <tr
                  key={item.id ?? `${item.plan}-${index}`}
                  className="border-t hover:bg-gray-50 transition"
                >

                  {/* PLAN */}
                  <td className="px-5 py-4 font-semibold">
                    {item.plan}
                  </td>

                  {/* CATEGORY */}
                  <td className="px-5">

                    {item.category ? (
                      <span className="px-3 py-1 rounded-full text-xs bg-violet-100 text-violet-700">
                        {item.category}
                      </span>
                    ) : (
                      <span className="text-gray-400">
                        —
                      </span>
                    )}

                  </td>

                  {/* TRADES */}
                  <td>
                    {Number(item.trades || 0)}
                  </td>

                  {/* WIN RATE */}
                  <td className="font-semibold text-green-600">
                    {Number(item.winRate || 0).toFixed(1)}%
                  </td>

                  {/* NET P&L */}
                  <td
                    className={`font-semibold ${
                      Number(item.netPnL || 0) >= 0
                        ? "text-green-600"
                        : "text-red-500"
                    }`}
                  >
                    $
                    {Math.abs(
                      Number(item.netPnL || 0)
                    ).toLocaleString()}
                  </td>

                  {/* RR */}
                  <td>
                    {Number(item.averageRR || 0).toFixed(2)}R
                  </td>

                  {/* PROFIT FACTOR */}
                  <td>
                    {Number(item.profitFactor || 0).toFixed(2)}
                  </td>

                </tr>

              ))
            ) : (

              <tr>
                <td
                  colSpan={7}
                  className="py-10 text-center text-sm text-gray-500"
                >
                  {search
                    ? "No matching trading plan found."
                    : "No trading plan data available."}
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
      className="cursor-pointer py-3 px-5 text-left select-none hover:text-gray-900"
    >

      <div className="flex items-center gap-1">

        {title}

        <ArrowUpDown size={14} />

      </div>

    </th>
  );
}