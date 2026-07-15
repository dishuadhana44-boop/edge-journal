import { Upload, X } from "lucide-react";

function Header({
  activeTab,
  setActiveTab,
  onClose,
  onEmojiRemove,
}) {
  return (
    <div className="h-11 border-b border-gray-200 px-4 flex items-center justify-between">

      <div className="flex items-center gap-6">

        <button
          onClick={() => setActiveTab("emoji")}
          className={`text-[14px] pb-2 border-b-2 transition ${
            activeTab === "emoji"
              ? "border-black text-black"
              : "border-transparent text-gray-500 hover:text-black"
          }`}
        >
          Emoji
        </button>

        <button
          onClick={() => setActiveTab("icons")}
          className={`text-[14px] pb-2 border-b-2 transition ${
            activeTab === "icons"
              ? "border-black text-black"
              : "border-transparent text-gray-500 hover:text-black"
          }`}
        >
          Icons
        </button>

        <button
          onClick={() => setActiveTab("upload")}
          className={`flex items-center gap-1 text-[14px] pb-2 border-b-2 transition ${
            activeTab === "upload"
              ? "border-black text-black"
              : "border-transparent text-gray-500 hover:text-black"
          }`}
        >
          <Upload size={13} />
          Upload
        </button>

      </div>

      <button
  onClick={() => {
    onEmojiRemove();
    onClose();
  }}
  className="mr-3 text-sm text-gray-500 hover:text-red-500"
>
  Remove Emoji
</button>

      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-gray-100"
      >
        <X size={17} />
      </button>

    </div>
  );
}

export default Header;