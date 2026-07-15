import { BubbleMenu } from "@tiptap/extension-bubble-menu";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code2,
} from "lucide-react";

function BubbleMenuBar({ editor }) {
  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 150 }}
      className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-xl p-1"
    >
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className="p-2 rounded-lg hover:bg-gray-100"
      >
        <Bold size={16} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className="p-2 rounded-lg hover:bg-gray-100"
      >
        <Italic size={16} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className="p-2 rounded-lg hover:bg-gray-100"
      >
        <Strikethrough size={16} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleCode().run()}
        className="p-2 rounded-lg hover:bg-gray-100"
      >
        <Code2 size={16} />
      </button>
    </BubbleMenu>
  );
}

export default BubbleMenuBar;