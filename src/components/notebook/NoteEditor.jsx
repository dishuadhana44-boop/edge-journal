import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";

function ToolbarButton({
  onClick,
  active = false,
  children,
  title,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`
        px-3
        py-2
        rounded-lg
        text-sm
        font-medium
        transition
        ${
          active
            ? "bg-purple-100 text-purple-700"
            : "text-gray-600 hover:bg-gray-100"
        }
      `}
    >
      {children}
    </button>
  );
}

export default function NoteEditor({
  content = "",
  onChange,
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,

      Underline,

      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),

      TextAlign.configure({
        types: [
          "heading",
          "paragraph",
        ],
      }),
    ],

    content,

    editorProps: {
      attributes: {
        class:
          "min-h-[430px] outline-none px-6 py-5 text-gray-800 leading-7",
      },
    },

    onUpdate({ editor }) {
      onChange?.(
        editor.getHTML()
      );
    },
  });

  useEffect(() => {
    if (!editor) return;

    const currentContent =
      editor.getHTML();

    if (
      content !== currentContent
    ) {
      editor.commands.setContent(
        content || "",
        false
      );
    }
  }, [editor, content]);

  if (!editor) {
    return (
      <div className="min-h-[430px] p-6 text-sm text-gray-400">
        Loading editor...
      </div>
    );
  }

  const setLink = () => {
    const previousUrl =
      editor.getAttributes("link")
        .href || "";

    const url = window.prompt(
      "Enter URL",
      previousUrl
    );

    if (url === null) {
      return;
    }

    if (url === "") {
      editor
        .chain()
        .focus()
        .unsetLink()
        .run();

      return;
    }

    editor
      .chain()
      .focus()
      .setLink({
        href: url,
      })
      .run();
  };

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50">

        <ToolbarButton
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleBold()
              .run()
          }
        >
          <strong>B</strong>
        </ToolbarButton>

        <ToolbarButton
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleItalic()
              .run()
          }
        >
          <em>I</em>
        </ToolbarButton>

        <ToolbarButton
          title="Underline"
          active={editor.isActive("underline")}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleUnderline()
              .run()
          }
        >
          <u>U</u>
        </ToolbarButton>

        <ToolbarButton
          title="Strike"
          active={editor.isActive("strike")}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleStrike()
              .run()
          }
        >
          <s>S</s>
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          title="Heading 1"
          active={editor.isActive(
            "heading",
            { level: 1 }
          )}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleHeading({
                level: 1,
              })
              .run()
          }
        >
          H1
        </ToolbarButton>

        <ToolbarButton
          title="Heading 2"
          active={editor.isActive(
            "heading",
            { level: 2 }
          )}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleHeading({
                level: 2,
              })
              .run()
          }
        >
          H2
        </ToolbarButton>

        <ToolbarButton
          title="Heading 3"
          active={editor.isActive(
            "heading",
            { level: 3 }
          )}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleHeading({
                level: 3,
              })
              .run()
          }
        >
          H3
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          title="Bullet List"
          active={editor.isActive(
            "bulletList"
          )}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleBulletList()
              .run()
          }
        >
          • List
        </ToolbarButton>

        <ToolbarButton
          title="Numbered List"
          active={editor.isActive(
            "orderedList"
          )}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleOrderedList()
              .run()
          }
        >
          1. List
        </ToolbarButton>

        <ToolbarButton
          title="Checklist"
          active={editor.isActive(
            "taskList"
          )}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleTaskList()
              .run()
          }
        >
          ☑
        </ToolbarButton>

        <ToolbarButton
          title="Blockquote"
          active={editor.isActive(
            "blockquote"
          )}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleBlockquote()
              .run()
          }
        >
          ❝
        </ToolbarButton>

        <ToolbarButton
          title="Code Block"
          active={editor.isActive(
            "codeBlock"
          )}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleCodeBlock()
              .run()
          }
        >
          {"</>"}
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          title="Align Left"
          active={editor.isActive({
            textAlign: "left",
          })}
          onClick={() =>
            editor
              .chain()
              .focus()
              .setTextAlign("left")
              .run()
          }
        >
          ≡
        </ToolbarButton>

        <ToolbarButton
          title="Align Center"
          active={editor.isActive({
            textAlign: "center",
          })}
          onClick={() =>
            editor
              .chain()
              .focus()
              .setTextAlign("center")
              .run()
          }
        >
          ≡
        </ToolbarButton>

        <ToolbarButton
          title="Align Right"
          active={editor.isActive({
            textAlign: "right",
          })}
          onClick={() =>
            editor
              .chain()
              .focus()
              .setTextAlign("right")
              .run()
          }
        >
          ≡
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          title="Add Link"
          active={editor.isActive("link")}
          onClick={setLink}
        >
          🔗
        </ToolbarButton>

        <ToolbarButton
          title="Undo"
          onClick={() =>
            editor
              .chain()
              .focus()
              .undo()
              .run()
          }
        >
          ↶
        </ToolbarButton>

        <ToolbarButton
          title="Redo"
          onClick={() =>
            editor
              .chain()
              .focus()
              .redo()
              .run()
          }
        >
          ↷
        </ToolbarButton>
      </div>

      {/* EDITOR */}
      <EditorContent
        editor={editor}
      />
    </div>
  );
}