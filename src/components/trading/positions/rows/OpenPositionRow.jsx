import PositionRow from "../PositionRow";

export default function OpenPositionRow({

  trade,
  demo = false,

}) {

  if (demo) {

    return (

      <tr className="border-b hover:bg-gray-50 transition">

        <td className="px-6 py-5 font-medium">
          EURUSD
        </td>

        <td>

          <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold">

            BUY

          </span>

        </td>

        <td>5.00</td>

        <td>1.18637</td>

        <td>1.18642</td>

        <td>1.18500</td>

        <td>1.18800</td>

        <td className="font-semibold text-emerald-600">

          +$18.50

        </td>

        <td>00:05:18</td>

        <td className="text-center">

          ⋮

        </td>

      </tr>

    );

  }

  return <PositionRow trade={trade} />;

}