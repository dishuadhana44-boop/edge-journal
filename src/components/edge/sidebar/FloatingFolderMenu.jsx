import { createPortal } from "react-dom";

export default function FloatingFolderMenu({
  open,
  x,
  y,
  children,
}) {
  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: x,
        top: y,
        width: 230,
        zIndex: 99999,
      }}
      className="
        bg-white
        rounded-2xl
        border
        border-gray-200
        shadow-2xl
        overflow-hidden
      "
    >
      {children}
    </div>,
    document.body
  );
}