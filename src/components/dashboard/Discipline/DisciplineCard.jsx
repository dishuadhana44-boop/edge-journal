import DisciplineBreakdown from "./DisciplineBreakdown";

function DisciplineCard({ trades = [], startDate, endDate }) {
  return (
    <div className="h-full">
      <DisciplineBreakdown
        trades={trades}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}

export default DisciplineCard;