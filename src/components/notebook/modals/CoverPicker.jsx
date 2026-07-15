import { useState } from "react";
import { gradients } from "../data/CoverData";
import { Image, Upload, X } from "lucide-react";

function CoverPicker({
  onClose,
  onSelectGradient,
  selectedGradient,
  onUpload,
  onRemove,
}) {
  const [activeTab, setActiveTab] = useState("gradients");
  const handleUpload = (e) => {
    const file = e.target.files[0];
  
    if (!file) return;
  
    const image = URL.createObjectURL(file);
  
    onUpload(image);
  
    onClose();
  };

  
  return (
    <div className="w-[420px] h-[460px] bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 h-14 ">

        <div className="flex items-center gap-6">

          <button
            onClick={() => setActiveTab("gradients")}
            className={`pb-2 border-b-2 text-sm font-medium transition ${
              activeTab === "gradients"
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-black"
            }`}
          >
            Gradients
          </button>

          <button
            onClick={() => setActiveTab("upload")}
            className={`flex items-center gap-2 pb-2 border-b-2 text-sm font-medium transition ${
              activeTab === "upload"
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-black"
            }`}
          >
            <Upload size={15} />
            Upload
          </button>

        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <X size={18} />
        </button>

      </div>

      {/* Body */}

      <div className="h-[350px] overflow-y-auto p-5">

  {activeTab === "gradients" && (
    <div className="grid grid-cols-3 gap-4">

      {gradients.map((gradient) => (
   <button
   key={gradient.id}
   type="button"
   onClick={() => {
     onSelectGradient(gradient.className);
     onClose();
   }}
   className={`
     w-full
     h-20
     rounded-2xl
     bg-gradient-to-r
     ${gradient.className}
     border border-gray-200
     shadow-sm
     hover:shadow-xl
     hover:scale-105
     active:scale-95
     transition-all
     duration-200
   `}
 />
      ))}

    </div>
  )}

{activeTab === "upload" && (

<div className="flex flex-col items-center justify-center h-full">

<label className="cursor-pointer">

<div className="w-56 h-36 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center hover:bg-gray-50 transition">

<Upload size={34} />

<p className="mt-3 text-sm">
Click to Upload
</p>

</div>

<input
type="file"
accept="image/*"
className="hidden"
onChange={handleUpload}
/>

</label>

</div>

)}

</div>

      {/* Footer */}

      <div className=" h-14 flex items-center px-5">

      <button
onClick={()=>{
onRemove();
onClose();
}}
className="text-red-500 hover:text-red-600"
>
Remove Cover
</button>

      </div>

    </div>
  );
}

export default CoverPicker;