import { useState, useEffect } from "react";

import { TextStyle } from "@tiptap/extension-text-style";
import { UnderlineIcon } from "lucide-react";
import Color from "@tiptap/extension-color";
import RichTextEditor from "./RichTextEditor";

import { Plus, Trash2 } from "lucide-react";
import { X } from "lucide-react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Undo2,
  Redo2,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";

function ReflectionSection({
  trade,
  setTrade,
}) {
  const [plans, setPlans] = useState([]);

  useEffect(() => {
  
    const savedPlans =
      JSON.parse(localStorage.getItem("edgeStrategies")) || [];
  
    setPlans(savedPlans);
  
  }, []);
      const entryTags = trade?.reflection?.entryTags || [];
      const [entryInput, setEntryInput] = useState("");
      
      const mistakeTags =
  trade?.reflection?.mistakeTags || [];
      const [mistakeInput, setMistakeInput] = useState("");
      
      const managementTags =
  trade?.reflection?.managementTags || [];
      const [managementInput, setManagementInput] = useState("");

      const addTag = (value, tags, setTags, setInput) => {

        const tag = value.trim();
      
        if (!tag) return;
      
        if (tags.includes(tag)) {
          setInput("");
          return;
        }
      
        setTrade({
          ...trade,
          reflection: {
            ...trade.reflection,
            entryTags: [...entryTags, tag],
          },
        });
      
        setInput("");
      
      };

      const removeTag = (tag, tags, setTags) => {

        setTrade({
          ...trade,
          reflection: {
            ...trade.reflection,
            entryTags: entryTags.filter((t) => t !== tag),
          },
        });
      
      };

      const [notes, setNotes] = useState("");
      
      const editor = useEditor({
        extensions: [
          StarterKit,
          Underline,
        
          TextStyle,
          Color,
          Placeholder.configure({
            placeholder: "Write your trade review...",
          }),
        ],
        content: trade?.reflection?.notes || "",
      
        onUpdate({ editor }) {
          setTrade({
            ...trade,
            reflection: {
              ...trade.reflection,
              notes: editor.getHTML(),
            },
          });
        },
      });

      const plainText = editor?.getText() || "";

      const wordCount =
        plainText.trim() === ""
          ? 0
          : plainText.trim().split(/\s+/).length;
      
      const characterCount = plainText.length;

    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mt-5">
  
        <h2 className="text-lg font-semibold">
          Review & Reflection
        </h2>
  
        <div className="grid grid-cols-2 gap-6 mt-5">
  
          {/* LEFT */}
  
          <div>
  
            {/* Plan */}
  
            <label className="text-sm font-medium">
              Plan
            </label>
  
            <label className="flex items-center gap-2 mt-2">
  
            <input
  type="checkbox"
  checked={trade?.reflection?.followedPlan || false}
  onChange={(e) =>
    setTrade({
      ...trade,
      reflection: {
        ...trade.reflection,
        followedPlan: e.target.checked,
      },
    })
  }
/>
  
              <span className="text-sm">
                I followed my trade plan
              </span>
  
            </label>
  
            {/* Entry Confluences */}
  
            <div className="mt-5">
  
              <label className="text-sm font-medium">
  Entry Confluences
</label>

<div className="mt-2 border rounded-xl p-2 min-h-[50px] flex flex-wrap gap-2">

  {entryTags.map((tag) => (

    <div
      key={tag}
      className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full flex items-center gap-2 text-sm"
    >
      {tag}

      <button
  onClick={() =>
    setTrade({
      ...trade,
      reflection: {
        ...trade.reflection,
        entryTags: entryTags.filter(
          (t) => t !== tag
        ),
      },
    })
  }
>
  <X size={14} />
</button>

    </div>

  ))}

  <input
    value={entryInput}
    onChange={(e) => setEntryInput(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
    
        const tag = entryInput.trim();
    
        if (tag && !entryTags.includes(tag)) {
          setTrade({
            ...trade,
            reflection: {
              ...trade.reflection,
              entryTags: [...entryTags, tag],
            },
          });
        }
    
        setEntryInput("");
      }
    }}
    placeholder="Type and press Enter..."
    className="flex-1 min-w-[140px] outline-none"
  />

</div>
  
            </div>
  
            {/* Mistakes */}
  
            <div className="mt-5">
  
            <label className="text-sm font-medium">
  Mistakes
</label>

<div className="mt-2 border rounded-xl p-2 min-h-[50px] flex flex-wrap gap-2">

  {mistakeTags.map((tag) => (

    <div
      key={tag}
      className="bg-red-100 text-red-700 px-3 py-1 rounded-full flex items-center gap-2 text-sm"
    >
      {tag}

      <button
  onClick={() =>
    setTrade({
      ...trade,
      reflection: {
        ...trade.reflection,
        mistakeTags: mistakeTags.filter(
          (t) => t !== tag
        ),
      },
    })
  }
>
  <X size={14} />
</button>

    </div>

  ))}

  <input
    value={mistakeInput}
    onChange={(e) => setMistakeInput(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
    
        const tag = mistakeInput.trim();
    
        if (tag && !mistakeTags.includes(tag)) {
          setTrade({
            ...trade,
            reflection: {
              ...trade.reflection,
              mistakeTags: [...mistakeTags, tag],
            },
          });
        }
    
        setMistakeInput("");
      }
    }}
    placeholder="Type and press Enter..."
    className="flex-1 min-w-[140px] outline-none"
  />

</div>
  
            </div>
  
            {/* Notes */}
  
            <div className="mt-5">

  <label className="text-sm font-medium">
    Notes
  </label>

  <div className="flex items-center gap-2 mt-2 mb-2">

<button
  type="button"
  onClick={() => editor?.chain().focus().toggleBold().run()}
  className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
    editor?.isActive("bold")
      ? "bg-purple-600 text-white border-purple-600"
      : "hover:bg-gray-100"
  }`}
>
  <Bold size={17} />
</button>

<button
  type="button"
  onClick={() => editor?.chain().focus().toggleItalic().run()}
  className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
    editor?.isActive("italic")
      ? "bg-purple-600 text-white border-purple-600"
      : "hover:bg-gray-100"
  }`}
>
  <Italic size={17} />
</button>

<button
  type="button"
  onClick={() => editor?.chain().focus().toggleUnderline().run()}
  className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
    editor?.isActive("underline")
      ? "bg-purple-600 text-white border-purple-600"
      : "hover:bg-gray-100"
  }`}
>
  <UnderlineIcon size={17} />
</button>



<input
  type="color"
  title="Text Color"
  onChange={(e) =>
    editor?.chain().focus().setColor(e.target.value).run()
  }
  className="w-9 h-9 rounded-lg border cursor-pointer p-1 bg-white"
/>

<button
  type="button"
  onClick={() => editor?.chain().focus().toggleBulletList().run()}
  className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
    editor?.isActive("bulletList")
      ? "bg-purple-600 text-white border-purple-600"
      : "hover:bg-gray-100"
  }`}
>
  <List size={17} />
</button>

<button
  type="button"
  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
  className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
    editor?.isActive("orderedList")
      ? "bg-purple-600 text-white border-purple-600"
      : "hover:bg-gray-100"
  }`}
>
  <ListOrdered size={17} />
</button>

<div className="w-px h-6 bg-gray-300 mx-1"></div>

<button
  type="button"
  onClick={() => editor?.chain().focus().undo().run()}
  className="w-9 h-9 rounded-lg border hover:bg-gray-100 flex items-center justify-center"
>
  <Undo2 size={17} />
</button>

<button
  type="button"
  onClick={() => editor?.chain().focus().redo().run()}
  className="w-9 h-9 rounded-lg border hover:bg-gray-100 flex items-center justify-center"
>
  <Redo2 size={17} />
</button>

</div>

<div className="mt-2 border rounded-xl bg-white overflow-hidden">

  <EditorContent
    editor={editor}
    className="p-4 min-h-[220px]"
  />

</div>

</div>
  
<div className="flex justify-between text-xs text-gray-500 mt-2">

<span>
Words: {wordCount}
    
</span>

<span>
Characters: {characterCount}
</span>

</div>

          </div>
  
          {/* RIGHT */}
  
          <div>
  
            {/* Trading Plan */}
  
            <div>
 

  <div className="space-y-2">

  <label className="block text-sm font-semibold mb-3">
  Which plan did you follow?
</label>

<select
  value={trade?.reflection?.selectedPlanId || ""}
  onChange={(e) => {

    const selected = plans.find(
      (p) => String(p.id) === e.target.value
    );

    setTrade({
      ...trade,
      reflection: {
        ...trade.reflection,
        selectedPlanId: selected?.id || "",
        selectedPlanTitle: selected?.title || "",
      },
    });

  }}
  className="
    w-full
    rounded-xl
    border
    border-gray-300
    px-4
    py-3
    bg-white
    focus:outline-none
    focus:ring-2
    focus:ring-violet-500
  "
>

  <option value="">
    Select Trading Plan
  </option>

  {plans.map((plan) => (

    <option
      key={plan.id}
      value={plan.id}
    >
      {plan.title}
    </option>

  ))}

</select>

  </div>



  

</div>
  
            
  
            {/* Trade Management */}
  
            <div className="mt-5">
  
            <label className="text-sm font-medium">
  Trade Management
</label>

<div className="mt-2 border rounded-xl p-2 min-h-[50px] flex flex-wrap gap-2">

  {managementTags.map((tag) => (

    <div
      key={tag}
      className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full flex items-center gap-2 text-sm"
    >
      {tag}

      <button
       onClick={() =>
        setTrade({
          ...trade,
          reflection: {
            ...trade.reflection,
            managementTags: managementTags.filter(
              (t) => t !== tag
            ),
          },
        })
      }
      >
        <X size={14} />
      </button>

    </div>

  ))}

  <input
    value={managementInput}
    onChange={(e) => setManagementInput(e.target.value)}
    onKeyDown={(e) => {

      if (e.key === "Enter") {

        e.preventDefault();

        const tag = managementInput.trim();

        if (tag && !managementTags.includes(tag)) {
          setTrade({
            ...trade,
            reflection: {
              ...trade.reflection,
              managementTags: [...managementTags, tag],
            },
          });
        }
        
        setManagementInput("");

      }

    }}
    placeholder="Type and press Enter..."
    className="flex-1 min-w-[140px] outline-none"
  />

</div>
  
            </div>
  
            {/* Entry Emotion */}
  
            <div className="mt-5">
  
              <label className="text-sm font-medium">
                Entry Emotion
              </label>
  
              <select
  value={trade?.reflection?.entryEmotion || "😀 Calm"}
  onChange={(e) =>
    setTrade({
      ...trade,
      reflection: {
        ...trade.reflection,
        entryEmotion: e.target.value,
      },
    })
  }
  className="mt-2 w-full border rounded-xl px-3 py-2"
>
  
                <option>😀 Calm</option>

                <option>😎 Confident</option>
  
                <option>😐 Neutral</option>
  
                <option>😰 Fear</option>
  
                <option>😈 Greedy</option>
  
              </select>
  
            </div>
  
            {/* Exit Emotion */}
  
            <div className="mt-5">
  
              <label className="text-sm font-medium">
                Exit Emotion
              </label>
  
              <select
  value={trade?.reflection?.exitEmotion || "😀 Satisfied"}
  onChange={(e) =>
    setTrade({
      ...trade,
      reflection: {
        ...trade.reflection,
        exitEmotion: e.target.value,
      },
    })
  }
  className="mt-2 w-full border rounded-xl px-3 py-2"
>
  
                <option>😀 Satisfied</option>
  
                <option>😐 Neutral</option>

                <option>😨 Fomo</option>

                <option>😱 Revenge</option>
  
                <option>😡 Angry</option>
  
              </select>
  
            </div>
  
          </div>
  
        </div>
  
      </div>
    );
  }
  
  export default ReflectionSection;