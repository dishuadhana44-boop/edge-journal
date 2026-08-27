import PreMarketModal from "./PreMarketModal";

export default function PreMarketRoutine({
  onClose,
  onComplete,
}) {
  return (
    <PreMarketModal
      onClose={onClose}
      onComplete={onComplete}
    />
  );
}