import StatisticsRow from "./StatisticsRow";

export default function StatisticsColumn({ title, data }) {
  return (
    <div className="flex flex-col">

      <div className="px-5 py-3 border-b bg-gray-50">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-800">
          {title}
        </h3>
      </div>

      <div className="divide-y divide-gray-100">

        {data.map((item, index) => (
          <StatisticsRow
            key={index}
            label={item.label}
            value={item.value}
            valueColor={item.color}
          />
        ))}

      </div>

    </div>
  );
}