import { useNavigate } from "react-router-dom";

import PageHeader from "../common/PageHeader";

function NotebookHeader() {
    const navigate = useNavigate();
    return (
        <div className="w-full flex items-center justify-between ">
  
        {/* Left */}
        <PageHeader
  title="Notebook"
  subtitle="Organize your trading ideas, notes and research."
  icon="notebook"
/>
  
        {/* Right */}
        <button 
        onClick={() => navigate("/notebook/editor/new")}
        className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg text-sm font-medium shadow-md transition">
            
          + New Note
        </button>
  
      </div>
    );
  }
  
  export default NotebookHeader;