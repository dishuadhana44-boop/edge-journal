import { useState } from "react";

import {
    Search,
    FileText,
    Star,
    Calendar,
    CalendarDays,
    BarChart3,
    Trophy,
    Crown,
    Folder,
    Trash2,
    ChevronDown,
    Plus,
    PanelLeftClose,
    PanelLeftOpen,
  } from "lucide-react";
  
  function NotebookSidebar({ isOpen, setIsOpen }) {
    return (
        <div
  className={`${
    isOpen ? "w-55" : "w-18"
  } h-full bg-white rounded-2xl border border-gray-200 p-3 flex flex-col overflow-hidden transition-all duration-300`}
>
 
  
        {/* Search */}
        <div
  className={`flex items-center bg-gray-100 rounded-xl px-3 py-2 mb-4 ${
    isOpen ? "justify-start gap-2" : "justify-center"
  }`}
>
  <Search size={18} className="text-gray-500" />

  {isOpen && (
    <input
      placeholder="Search..."
      className="bg-transparent outline-none w-full text-sm"
    />
  )}
</div>
  
        {/* Recent */}
        <Section title="Recent Notes" isOpen={isOpen}>
        <Item icon={FileText} text="Morning Routine" isOpen={isOpen} />
        <Item icon={FileText} text="Trading Notes" isOpen={isOpen} />
        </Section>
  
        {/* Notes */}
        <Section title="Notes" isOpen={isOpen}>
        <Item icon={Star} text="Favorites" isOpen={isOpen} />
        <Item icon={FileText} text="All Notes" isOpen={isOpen} />
        </Section>
  
        {/* Reviews */}
        <Section title="Reviews" isOpen={isOpen}>
        <Item icon={Calendar} text="Daily Review" isOpen={isOpen} />
<Item icon={CalendarDays} text="Weekly Review" isOpen={isOpen} />
<Item icon={BarChart3} text="Monthly Review" isOpen={isOpen} />
<Item icon={Trophy} text="Quarterly Review" isOpen={isOpen} />
<Item icon={Crown} text="Yearly Review" isOpen={isOpen} />
        </Section>
  
        {/* Bottom */}
        <div className="mt-auto border-t border-gray-200 pt-3">

<Item icon={Folder} text="Folders" isOpen={isOpen} />

<div
  className={`flex items-center ${
    isOpen ? "justify-between" : "justify-center"
  }`}
>
  <Item icon={Trash2} text="Trash" isOpen={isOpen} />

  {isOpen && (
    <button
    onClick={() => setIsOpen(!isOpen)}
      className="p-2 rounded-lg hover:bg-gray-100 transition"
    >
      <PanelLeftClose size={18} />
    </button>
  )}
</div>

{!isOpen && (
  <button
  onClick={() => setIsOpen(!isOpen)}
    className="w-full flex justify-center mt-2 p-2 rounded-lg  "
  >
    <PanelLeftOpen size={18} />
  </button>
)}

</div>
  
      </div>
    );
  }
  
  function Section({ title, children, isOpen }) {
    const [open, setOpen] = useState(true);
  
    return (
      <div className="mb-0">
  
  {isOpen && (
  <button
    onClick={() => setOpen(!open)}
    className="w-full flex items-center gap-2 text-sm font-semibold text-gray-500 mb-1 hover:text-purple-600 transition"
  >
    <ChevronDown
      size={15}
      className={`transition-transform duration-200 ${
        open ? "rotate-0" : "-rotate-90"
      }`}
    />

    <span>{title}</span>
  </button>
)}
  
        {open && (
          <div className="space-y-0.5">
            {children}
          </div>
        )}
  
      </div>
    );
  }
  
  function Item({ icon: Icon, text, isOpen }) {
    return (
      <button
        className={`w-full flex items-center rounded-xl hover:bg-purple-50 hover:text-purple-600 transition ${
          isOpen
            ? "gap-3 px-3 py-2 justify-start"
            : "justify-center py-2"
        }`}
      >
        <Icon size={18} />
  
        {isOpen && <span>{text}</span>}
      </button>
    );
  }
  export default NotebookSidebar;