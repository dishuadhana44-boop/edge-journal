import { X, Link2, Globe, Lock } from "lucide-react";
import { toast } from "react-hot-toast";

function ShareModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">

      <div className="w-[430px] bg-white rounded-2xl shadow-2xl p-6">

        <div className="flex justify-between items-center mb-6">

          <h2 className="text-xl font-semibold">
            Share Note
          </h2>

          <button onClick={onClose}>
            <X size={20} />
          </button>

        </div>

        <button
 onClick={() => {
    navigator.clipboard.writeText(window.location.href);
  
    onClose();
  
    toast.success("Link copied!", {
      id: "copy-link",
    });
  }}
  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100"
>
  <Link2 size={18} />
  Copy Link
</button>
        <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100">

          <Globe size={18} />

          Publish to Web

        </button>

        <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100">

          <Lock size={18} />

          Private

        </button>

      </div>

    </div>
  );
}

export default ShareModal;