import { useNavigate } from "react-router-dom";
function TemplateCard({ title }) {
    const navigate = useNavigate();
    return (
      <div 
      onClick={() => navigate("/notebook/editor/new")}
      className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-lg hover:border-purple-500 transition cursor-pointer">
  
        <div className="h-36 rounded-xl bg-gray-100 mb-4"></div>
  
        <h3 className="font-semibold">
          {title}
        </h3>
  
        <p className="text-sm text-gray-500 mt-2">
          Click to create a note using this template.
        </p>
  
      </div>
    );
  }
  
  export default TemplateCard;