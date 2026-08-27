import { Award } from "lucide-react";

function DisciplineScore({ score = 0 }) {
  const safeScore = Math.max(
    0,
    Math.min(100, Number(score) || 0)
  );

  const radius = 62;
  const stroke = 10;

  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  const strokeDashoffset =
    circumference -
    (safeScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-44 h-44">
        <svg
          className="w-full h-full -rotate-90"
          viewBox="0 0 140 140"
        >
          {/* Background */}
          <circle
            cx="70"
            cy="70"
            r={normalizedRadius}
            fill="transparent"
            stroke="#E5E7EB"
            strokeWidth={stroke}
          />

          {/* Score */}
          <circle
            cx="70"
            cy="70"
            r={normalizedRadius}
            fill="transparent"
            stroke="#8B5CF6"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition:
                "stroke-dashoffset .8s ease",
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Award
            size={18}
            className="text-violet-600 mb-1"
          />

          <h2 className="text-3xl font-bold text-gray-900">
            {safeScore}
          </h2>

          <p className="text-xs text-gray-500">
            Discipline Score
          </p>
        </div>
      </div>
    </div>
  );
}

export default DisciplineScore;