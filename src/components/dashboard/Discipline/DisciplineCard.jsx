import DisciplineBreakdown from "./DisciplineBreakdown";

function DisciplineCard({ trades = [] }) {
  console.log("DisciplineCard trades:", trades);

  return (
    <div className="h-full">
      <DisciplineBreakdown trades={trades} />
    </div>
  );
}

export default DisciplineCard;