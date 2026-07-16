import { useState } from "react";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import BlockHandleExtension from "./extensions/BlockHandleExtension";
import BlockHandle from "./ui/BlockHandle";
import { useRef, useEffect } from "react";
import { Plus, GripVertical } from "lucide-react";
import BlockMenu from "./menus/BlockMenu";
import SlashMenu from "./SlashMenu";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import BlockToolbar from "./toolbar/BlockToolbar";
import MenuController from "./controllers/MenuController";

import { useMemo } from "react";
import EditorEngine from "./core/EditorEngine";
import EditorContext from "./core/EditorContext";


function Editor() {
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const menuRef = useRef(null);
  const blockMenuRef = useRef(null);
  const [showBlockTools, setShowBlockTools] = useState(false);
  
  const [showBlockMenu, setShowBlockMenu] = useState(false);


  const editor = useEditor({
    extensions: [
      StarterKit,
    
      BlockHandleExtension,
    
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    
      
    
      Image,
    
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "paragraph") {
            return "Type '/' for commands...";
          }
          return "";
        },
      }),
    ],
  
    content: "",
  
  
  
    editorProps: {
      attributes: {
        class:
          "prose prose-lg max-w-none focus:outline-none min-h-[500px] px-2",
      },
    },
  });

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setShowSlashMenu(false);
      }
      
      if (
        blockMenuRef.current &&
        !blockMenuRef.current.contains(event.target)
      ) {
        setShowBlockMenu(false);
      }
    }
  
    document.addEventListener("mousedown", handleClickOutside);
  
    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  const engine = useMemo(() => {
    if (!editor) return null;
  
    return new EditorEngine(editor);
  }, [editor]);

  if (!editor) return null;

  return (
    <EditorContext.Provider
      value={{
        editor,
        engine,
      }}
    >

    <div className="relative group">
  
      {/* Notion Block Handle */}
      
  
 

      <div
  onClick={() => setShowBlockTools(true)}
  className="relative"
>
{showBlockTools && (
  <BlockToolbar
    onPlusClick={() => setShowSlashMenu(true)}
    onGripClick={() => setShowBlockMenu(true)}
  />
)}
<MenuController
  showSlashMenu={showSlashMenu}
  showBlockMenu={showBlockMenu}
  menuRef={menuRef}
  blockMenuRef={blockMenuRef}
  editor={editor}
  onCloseSlash={() => setShowSlashMenu(false)}
  onCloseBlock={() => setShowBlockMenu(false)}
/>

  <EditorContent editor={editor} />
</div>
  
    </div>
    </EditorContext.Provider>

  );
}

export default Editor;