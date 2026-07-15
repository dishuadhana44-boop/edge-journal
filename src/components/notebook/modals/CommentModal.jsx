import { X } from "lucide-react";

function CommentModal({
    open,
    onClose,
    comment,
    setComment,
    onSave,
  }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[100]">

      <div className="w-[500px] bg-white rounded-2xl shadow-2xl p-6">

        <div className="flex justify-between items-center mb-5">

          <h2 className="text-xl font-semibold">
            Add Comment
          </h2>

          <button onClick={onClose}>
            <X size={20} />
          </button>

        </div>

        <textarea
          value={comment}
          onChange={(e)=>setComment(e.target.value)}
          placeholder="Write your comment..."
          className="w-full h-40 border rounded-xl p-4 outline-none resize-none"
        />

        <div className="flex justify-end gap-3 mt-5">

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>

          <button
  onClick={() => {
    if (!comment.trim()) return;

    onSave(comment);
    setComment("");
    onClose();
  }}
  className="px-5 py-2 rounded-lg bg-black text-white"
>
  Comment
</button>

        </div>

      </div>

    </div>
  );
}

export default CommentModal;