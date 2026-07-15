import { useState } from "react";
import {  useEffect } from "react";
import {  AnimatePresence } from "framer-motion";
import ShareModal from "../components/notebook/modals/ShareModal";
import Editor from "../components/notebook/editor/Editor.jsx";
import { useNavigate } from "react-router-dom";
import NoteMenu from "../components/notebook/editor/NoteMenu";
import {
  SmilePlus,
  ImagePlus,
  MessageSquarePlus,
} from "lucide-react";
import { motion } from "framer-motion";

import { Book } from "lucide-react";
import CoverPicker from "../components/notebook/modals/CoverPicker";
import CommentModal from "../components/notebook/modals/CommentModal";
import {
  MoreHorizontal,
  Trash2,
  Pencil,
  Copy,
  Pin,
} from "lucide-react";
import Toast from "../components/notebook/ui/Toast";
import DeleteCommentModal from "../components/notebook/modals/DeleteCommentModal";
import IconPicker from "../components/notebook/emoji-picker/IconPicker";




function NoteEditor() {
  const navigate = useNavigate();
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [coverClass, setCoverClass] = useState(
    "from-purple-500 via-violet-500 to-indigo-500"
  );
  const [favorite, setFavorite] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Saved");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [noteIcon, setNoteIcon] = useState(<Book size={44} />);
  const [commentOpen, setCommentOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
const [comment, setComment] = useState("");
const [comments, setComments] = useState([]);
const [openMenuId, setOpenMenuId] = useState(null);
const [editingId, setEditingId] = useState(null);
const [editingText, setEditingText] = useState("");
const [toastOpen, setToastOpen] = useState(false);
const [toastMessage, setToastMessage] = useState("");
const [deleteOpen, setDeleteOpen] = useState(false);
const [selectedCommentId, setSelectedCommentId] = useState(null);
const [editingCommentId, setEditingCommentId] = useState(null);
const [editText, setEditText] = useState("");
const [coverImage, setCoverImage] = useState(null);
const [hasCover, setHasCover] = useState(false);
const [iconAdded, setIconAdded] = useState(false);


const confirmDelete = () => {
  setComments((prev) =>
    prev.filter((item) => item.id !== selectedCommentId)
  );

  setDeleteOpen(false);
  setOpenMenuId(null);
};

  useEffect(() => {
    setSaveStatus("Saving...");

    const deleteComment = (id) => {
      setComments((prev) =>
        prev.filter((item) => item.id !== id)
      );
    
    
      showToast("Comment deleted");
    };
    
    const editComment = (item) => {
      setEditingId(item.id);
      setEditingText(item.text);
      setOpenMenuId(null);
    };
    const saveEditedComment = () => {
      setComments((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                text: editingText,
                time: "Edited just now",
              }
            : item
        )
      );
    
      setEditingId(null);
      setEditingText("");

      showToast("Comment updated");
    };
    const copyComment = async (text) => {
      try {
        await navigator.clipboard.writeText(text);
    
        showToast("Comment copied");
    
      } catch (err) {
        console.error(err);
      }
    };
    const showToast = (message) => {
      setToastMessage(message);
      setToastOpen(true);
    
      setTimeout(() => {
        setToastOpen(false);
      }, 2000);
    };

    const removeIcon = () => {
      setNoteIcon(<Book size={44} />);
      setIconAdded(false);
    };

    const timer = setTimeout(() => {
      setSaveStatus("Saved");
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    
      <div className="h-screen bg-gray-50 overflow-auto">
  
        {/* Top Bar */}
        <div className="h-10  bg-white flex items-center justify-between px-6">
  
        <button
  onClick={() => navigate("/notebook")}
  className="text-gray-600 hover:text-black transition"
>
  ← Back
</button>
  
          <div className="flex items-center gap-3">
  
          <span className="text-sm text-gray-500">
  {saveStatus}
</span>

          <button
  onClick={() => setFavorite(!favorite)}
  className={`text-2xl transition duration-200 ${
    favorite ? "text-yellow-400 scale-110" : "text-gray-400"
  }`}
>
  ★
</button>
  
            <button
  onClick={() => setShareOpen(true)}
  className="px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
>
  Share
</button>
  
            <NoteMenu />
  
          </div>
  
        </div>
  
        {/* Editor */}
  
        <div className="flex w-full h-[calc(100vh-40px)]">

        <motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 1 }}
  className="flex-1 overflow-y-auto px-8 pt-3 pb-8 bg-gray-50"
>


{hasCover && (

<div
  className={`relative h-52 rounded-2xl ${
    coverImage ? "" : `bg-gradient-to-r ${coverClass}`
  }`}
>

  {coverImage && (
    <img
      src={coverImage}
      alt="Cover"
      className="w-full h-full object-cover rounded-2xl"
    />
  )}
   

        <div className="absolute bottom-4 right-4">

<button
  onClick={() => setCoverPickerOpen(!coverPickerOpen)}
  className="bg-white/90 hover:bg-white px-4 py-2 rounded-lg text-sm font-medium shadow transition"
>
  📷 Change Cover
</button>

{coverPickerOpen && (
  <div className="absolute right-0 top-10 z-50">
<CoverPicker
  selectedGradient={coverClass}
  onClose={() => setCoverPickerOpen(false)}
  onSelectGradient={(gradient) => {
    setCoverImage(null);
    setCoverClass(gradient);
  }}
  onUpload={(image) => {
    setCoverImage(image);
  }}
  onRemove={() => {
    setHasCover(false);
    setCoverImage(null);
  
    setCoverClass(
      "from-purple-500 via-violet-500 to-indigo-500"
    );
  
    setCoverPickerOpen(false);
  }}
/>
  </div>
)}


</div>

</div>
)}
  
{/* Notion Actions */}
<div className="relative flex items-center gap-3 mt-3 ml-2 mb-4">

<div className="relative">

<div className="relative">

{!iconAdded ? (
  <motion.button
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.98 }}
    onClick={() => setShowIconPicker(true)}
    className="flex items-center gap-2 px-2 py-1 rounded-md text-sm text-gray-500 hover:bg-gray-100"
  >
    <SmilePlus size={16} />
    Add icon
  </motion.button>
) : (
  <button
    onClick={() => setShowIconPicker(true)}
    className="mt-3 ml-1 text-5xl hover:scale-110 transition"
  >
    {noteIcon}
  </button>
)}

<AnimatePresence>
  {showIconPicker && (
    <div className="absolute top-12 left-0 z-50">
     <IconPicker
  onClose={() => setShowIconPicker(false)}
  onEmojiSelect={(emoji) => {
    setNoteIcon(<span className="text-5xl">{emoji}</span>);
    setIconAdded(true);
    setShowIconPicker(false);
  }}
  onIconSelect={(Icon) => {
    setNoteIcon(<Icon size={42} />);
    setIconAdded(true);
    setShowIconPicker(false);
  }}
  onEmojiRemove={() => {
    setNoteIcon(<Book size={44} />);
    setIconAdded(false);
  }}
/>
    </div>
  )}
</AnimatePresence>

</div>

 

   

</div>

{!hasCover && (

<div className="relative">

  <motion.button
    whileHover={{ y: -2, scale: 1.03 }}
    whileTap={{ scale: 0.96 }}
    transition={{ duration: 0.18 }}
    onClick={() => {
      setHasCover(true);

      setCoverClass(
        "from-purple-500 via-violet-500 to-indigo-500"
      );
    }}
    className="flex items-center gap-2 text-gray-500 hover:bg-gray-100 px-2 py-1 rounded-md text-sm"
  >
    <ImagePlus size={16} />
    <span>Add cover</span>
  </motion.button>

</div>

)}

<motion.button
  whileHover={{ y: -2, scale: 1.03 }}
  whileTap={{ scale: 0.96 }}
  transition={{ duration: 0.18 }}
  onClick={() => {
    setCommentOpen(true);
    setShowComments(true);
  }}
  className="flex items-center gap-2 text-gray-500 hover:bg-gray-100 px-2 py-1 rounded-md text-sm"
>
  <MessageSquarePlus size={16} />
  <span>Add comment</span>
</motion.button>

</div>



<div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">

<input
  placeholder="New Page"
  className="
    w-full
    bg-transparent
    outline-none
    border-none
    text-[40px]
    font-bold
    font-mono
    text-[#37352F]
    leading-tight
    placeholder:text-[#9B9A97]
    mb-0
  "
/>


<Editor />

</div>
          
          

          </motion.div>
  
          {showComments && (
 <aside className="w-[300px] bg-white border-l border-gray-200 h-full flex flex-col shadow-sm">

    <div className="h-10 border-b flex items-center justify-between px-4">

      <h3 className="font-semibold">
        Comments
      </h3>

      <button
        onClick={() => setShowComments(false)}
        className="text-gray-500 hover:text-black"
      >
        ✕
      </button>

    </div>

    <div className="flex-1 overflow-y-auto p-4 space-y-4">

      {comments.length === 0 ? (

<div className="flex flex-col items-center justify-center h-full text-gray-400">

<MessageSquarePlus size={40} />

<p className="mt-3 text-sm">
  No comments yet
</p>

<p className="text-xs mt-1">
  Select text or use "Add Comment"
</p>

</div>

      ) : (

        <div className="space-y-4">

{comments.map((item) => (

<div
  key={item.id}
  className="relative rounded-xl border p-4 bg-white hover:bg-gray-50 transition"
>

  <div className="flex justify-between items-start">

  {editingId === item.id ? (

<div className="w-full">

  <textarea
    value={editingText}
    onChange={(e) => setEditingText(e.target.value)}
    className="w-full border rounded-lg p-2 text-sm resize-none outline-none"
    rows={3}
  />

  <div className="flex gap-2 mt-2">

    <button
      onClick={saveEditedComment}
      className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs"
    >
      Save
    </button>

    <button
      onClick={() => {
        setEditingId(null);
        setEditingText("");
      }}
      className="px-3 py-1 border rounded-lg text-xs"
    >
      Cancel
    </button>

  </div>

</div>

) : (

<p className="text-sm flex-1">
  {item.text}
</p>

)}

    <button
      onClick={() =>
        setOpenMenuId(
          openMenuId === item.id ? null : item.id
        )
      }
      className="p-1 rounded-md hover:bg-gray-100"
    >
      <MoreHorizontal size={18} />
    </button>

  </div>

  <span className="text-xs text-gray-500 mt-2 block">
    {item.time}
  </span>

  {openMenuId === item.id && (
    <div className="absolute right-3 top-10 w-44 bg-white rounded-xl border shadow-xl overflow-hidden z-50">

<button
  onClick={() => {
    setEditingCommentId(item.id);
    setEditText(item.text);
    setOpenMenuId(null);
  }}
  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-sm"
>
  ✏ Edit
</button>

<button
 onClick={() => {
  navigator.clipboard.writeText(item.text);

  setToast({
    show: true,
    message: "Comment copied",
  });

  setOpenMenuId(null);
}}
  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-sm"
>
  <Copy size={16} />
  Copy
</button>

      <button className="w-full px-4 py-2 text-left hover:bg-gray-100">
        Pin
      </button>

      <button
  onClick={() => {
    setSelectedCommentId(item.id);
    setDeleteOpen(true);
    setOpenMenuId(null);
  }}
  className="w-full flex items-center gap-3 px-4 py-2 text-red-500 hover:bg-red-50 text-sm"
>
  <Trash2 size={16} />
  Delete
</button>

    </div>
  )}

</div>

))}

        </div>

      )}

    </div>

  </aside>
)}

          </div>

<ShareModal
  open={shareOpen}
  onClose={() => setShareOpen(false)}
/>
<CommentModal
  open={commentOpen}
  onClose={() => setCommentOpen(false)}
  comment={comment}
  setComment={setComment}
  onSave={(text) => {
    setComments((prev) => [
      ...prev,
      {
        id: Date.now(),
        text,
        time: "Just now",
      },
    ]);
  }}
/>
<Toast
  show={toastOpen}
  message={toastMessage}
  onClose={() => setToastOpen(false)}
/>
<DeleteCommentModal
  open={deleteOpen}
  onClose={() => setDeleteOpen(false)}
  onDelete={confirmDelete}
/>

</div>
  
);
}
  export default NoteEditor;