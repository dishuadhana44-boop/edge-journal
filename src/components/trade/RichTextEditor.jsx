import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";

function RichTextEditor({
  value,
  onChange,
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({
        placeholder: "Write your trade review...",
      }),
    ],

    content: value,

    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  return (
    <div className="mt-2 border rounded-xl overflow-hidden bg-white">
  
      <EditorContent
        editor={editor}
        className="p-4 min-h-[220px]"
      />
  
    </div>
  );
}

export default RichTextEditor;