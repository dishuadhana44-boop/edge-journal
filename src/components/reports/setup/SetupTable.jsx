import { useMemo, useState } from "react";
import { Search, ArrowUpDown } from "lucide-react";

export default function SetupTable({ data }) {

  const [search, setSearch] = useState("");

  const [sortField, setSortField] = useState("netPnL");

  const [ascending, setAscending] = useState(false);

  function handleSort(field) {

    if (sortField === field) {
      setAscending(!ascending);
    } else {
      setSortField(field);
      setAscending(false);
    }

  }

  const filteredData = useMemo(() => {

    let rows = data.filter((item) =>
      item.setup.toLowerCase().includes(search.toLowerCase())
    );

    rows.sort((a, b) => {

      if (typeof a[sortField] === "string") {

        return ascending
          ? a[sortField].localeCompare(b[sortField])
          : b[sortField].localeCompare(a[sortField]);

      }

      return ascending
        ? a[sortField] - b[sortField]
        : b[sortField] - a[sortField];

    });

    return rows;

  }, [data, search, sortField, ascending]);

  return (

    <div>

      <div className="flex items-center justify-between mb-5">

        <div className="relative w-72">

          <Search
            size={16}
            className="absolute left-3 top-3 text-gray-400"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Setup..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-violet-500 outline-none"
          />

        </div>

      </div>

      <div className="rounded-xl border overflow-hidden">

        <table className="w-full">

          <thead className="bg-gray-50">

            <tr className="text-sm text-gray-600">

              <Header
                title="Setup"
                field="setup"
                onSort={handleSort}
              />

              <th className="py-3 text-left">Category</th>

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

            {filteredData.map((item) => (

              <tr
                key={item.id}
                className="border-t hover:bg-gray-50 transition"
              >

                <td className="px-5 py-4 font-semibold">

                  {item.setup}

                </td>

                <td>

                  <span className="px-3 py-1 rounded-full text-xs bg-violet-100 text-violet-700">

                    {item.category}

                  </span>

                </td>

                <td>{item.trades}</td>

                <td className="font-semibold text-green-600">

                  {item.winRate.toFixed(1)}%

                </td>

                <td
                  className={`font-semibold ${
                    item.netPnL >= 0
                      ? "text-green-600"
                      : "text-red-500"
                  }`}
                >

                  ${item.netPnL.toLocaleString()}

                </td>

                <td>{item.averageRR}R</td>

                <td>{item.profitFactor}</td>

              </tr>

            ))}

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
      className="cursor-pointer py-3 px-5 text-left select-none"
    >

      <div className="flex items-center gap-1">

        {title}

        <ArrowUpDown size={14} />

      </div>

    </th>

  );

}