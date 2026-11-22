export default function CardShell({
  title,
  subtitle,
  unit,
  stats = [],
  footer,
  children,
  bodyClassName = "px-3 py-3",
}) {
  return (
    <section className="h-full min-h-0 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="shrink-0 border-b border-gray-100 px-4 pt-3 pb-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3
              className="truncate text-sm font-semibold leading-tight text-gray-900"
              title={title}
            >
              {title}
            </h3>

            {subtitle && (
              <p
                className="mt-1 truncate text-[11px] leading-tight text-gray-500"
                title={subtitle}
              >
                {subtitle}
              </p>
            )}
          </div>

          {unit && (
            <span className="shrink-0 rounded-md bg-gray-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {unit}
            </span>
          )}
        </div>

        {stats.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-gray-400">
                  {stat.label}
                </span>

                <span
                  className={`text-xs font-bold tabular-nums ${
                    stat.tone ?? "text-gray-900"
                  }`}
                >
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </header>

      <div className={`flex-1 min-h-0 ${bodyClassName}`}>{children}</div>

      {footer && (
        <div className="shrink-0 border-t border-gray-100 px-4 py-2 text-[10px] text-gray-500">
          {footer}
        </div>
      )}
    </section>
  );
}
