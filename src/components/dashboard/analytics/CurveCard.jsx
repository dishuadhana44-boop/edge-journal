import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from "recharts";

import CardShell from "./CardShell";

function ChartTooltip({ active, payload, label, formatter, metaKeys }) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload ?? {};

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>

      {payload.map((entry) => (
        <p
          key={entry.dataKey}
          className="text-sm font-bold tabular-nums"
          style={{ color: entry.color ?? entry.stroke }}
        >
          {formatter(entry.value)}
        </p>
      ))}

      {metaKeys
        ?.filter(({ key }) => row[key] !== undefined && row[key] !== null)
        .map(({ key, label: metaLabel, format }) => (
          <p key={key} className="text-[11px] text-gray-500">
            {metaLabel}: {format ? format(row[key]) : row[key]}
          </p>
        ))}
    </div>
  );
}

export default function CurveCard({
  title,
  subtitle,
  unit,
  data = [],
  xKey = "label",
  dataKeys = [],
  type = "bar",
  signed = false,
  formatter = (value) => `${value}`,
  axisFormatter,
  emptyMessage = "No data available yet.",
  stats = [],
}) {
  const visibleData = data.filter((point) => point !== null);

  const primary = dataKeys[0];

  const gradientId = `curve-${String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}-fill`;

  return (
    <CardShell title={title} subtitle={subtitle} unit={unit} stats={stats}>
      {visibleData.length === 0 ? (
        <div className="h-full flex items-center justify-center px-4 text-center text-xs leading-relaxed text-gray-500">
          {emptyMessage}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={visibleData}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={primary.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={primary.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke="#F1F5F9" />

            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={{ stroke: "#E2E8F0" }}
              tickMargin={6}
              height={24}
              tick={{ fontSize: 10, fill: "#64748B" }}
              interval="preserveStartEnd"
              minTickGap={16}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fontSize: 10, fill: "#64748B" }}
              tickFormatter={axisFormatter ?? formatter}
            />

            <Tooltip
              cursor={{ fill: "rgba(99,102,241,0.08)" }}
              allowEscapeViewBox={{ x: false, y: false }}
              wrapperStyle={{ zIndex: 20 }}
              content={
                <ChartTooltip formatter={formatter} metaKeys={primary.metaKeys} />
              }
            />

            {primary.baseline !== false && (
              <ReferenceLine y={0} stroke="#CBD5E1" strokeDasharray="4 4" />
            )}

            {type === "bar" ? (
              <Bar
                dataKey={primary.key}
                name={primary.label}
                radius={[3, 3, 0, 0]}
                maxBarSize={34}
                isAnimationActive={false}
              >
                {visibleData.map((point, index) => (
                  <Cell
                    key={`${point[xKey]}-${index}`}
                    fill={
                      signed && point[primary.key] < 0 ? "#EF4444" : primary.color
                    }
                  />
                ))}
              </Bar>
            ) : (
              <Area
                type="monotone"
                dataKey={primary.key}
                name={primary.label}
                stroke={primary.color}
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </CardShell>
  );
}
