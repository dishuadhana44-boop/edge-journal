import EntryLine from "./EntryLine";
import SLLine from "./SLLine";
import TPLine from "./TPLine";

export default function PositionOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none z-20">

      <TPLine />

      <EntryLine />

      <SLLine />

    </div>
  );
}