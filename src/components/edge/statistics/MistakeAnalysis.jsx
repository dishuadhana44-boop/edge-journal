import {
  AlertTriangle,
} from "lucide-react";

export default function MistakeAnalysis({ plan }) {

  const allTrades =
    JSON.parse(localStorage.getItem("trades")) || [];

  const planTrades = allTrades.filter(
    (trade) =>
      trade?.reflection?.selectedPlanId === plan?.id
  );

  const mistakeCounts = {};

  planTrades.forEach((trade) => {

    if (!trade.mistakes) return;

    trade.mistakes.forEach((mistake) => {

      mistakeCounts[mistake] =
        (mistakeCounts[mistake] || 0) + 1;

    });

  });

  const mistakeRows = Object.entries(mistakeCounts)
    .sort((a, b) => b[1] - a[1]);

  const maxCount =
    mistakeRows.length > 0
      ? mistakeRows[0][1]
      : 1;

  return (

    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">

      <div className="p-6 border-b">

        <h2 className="text-xl font-bold">
          Mistake Analysis
        </h2>

      </div>

      <div className="p-6 space-y-5">

        {mistakeRows.length === 0 ? (

          <div className="text-center py-12 text-gray-400">

            No mistakes recorded

          </div>

        ) : (

          mistakeRows.map(([mistake, count]) => {

            const percent =
              Math.round((count / maxCount) * 100);

            return (

              <div key={mistake}>

                <div className="flex items-center justify-between mb-2">

                  <div className="flex items-center gap-3">

                    <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">

                      <AlertTriangle
                        size={18}
                        className="text-red-500"
                      />

                    </div>

                    <div>

                      <h4 className="font-medium">

                        {mistake}

                      </h4>

                      <p className="text-xs text-gray-500">

                        {count} Trades

                      </p>

                    </div>

                  </div>

                  <span className="font-semibold">

                    {percent}%

                  </span>

                </div>

                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">

                  <div
                    className="h-full bg-red-500"
                    style={{
                      width: `${percent}%`,
                    }}
                  />

                </div>

              </div>

            );

          })

        )}

      </div>

    </div>

  );

}