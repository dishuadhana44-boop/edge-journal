import { useNavigate } from "react-router-dom";
function NotebookHeader() {
    const navigate = useNavigate();
    return (
        <div className="w-full flex items-center justify-between py-0">
  
        {/* Left */}
        <div className="flex items-center gap-3">
  
          <h1 className="text-2xl font-bold text-gray-900">
            Notebook
          </h1>
  
          <p className="text-sm text-gray-400 mt-1">
            Think before you trade. Review before you repeat.
          </p>
  
        </div>
  
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