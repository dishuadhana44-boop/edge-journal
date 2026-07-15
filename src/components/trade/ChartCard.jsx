import { useEffect, useRef, useState } from "react";
import { Eye, Trash2, Pencil, ImagePlus } from "lucide-react";

function ChartCard({
  title,
  image,
  onChange,
}) {
  const inputRef = useRef(null);

  
  const [showViewer, setShowViewer] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const [dragging, setDragging] = useState(false);
  
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const move = (e) => {
      if (!dragging) return;
  
      setPosition({
        x: e.clientX - startPoint.x,
        y: e.clientY - startPoint.y,
      });
    };
  
    const up = () => {
      setDragging(false);
    };
  
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [dragging, startPoint]);

  const handleSelect = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      onChange(reader.result);
    };

    reader.readAsDataURL(file);
  };

  const handleReplace = () => {

    inputRef.current.click();
  
  };

  const handleDelete = () => {
    onChange("");
  };

  const handlePreview = () => {
  setZoom(1);
  setPosition({ x: 0, y: 0 });

  setSelectedImage(image);
  setShowViewer(true);
};
useEffect(() => {

    const handleEsc = (e) => {
  
      if (e.key === "Escape") {
  
        setShowViewer(false);
  
      }
  
    };
  
    window.addEventListener("keydown", handleEsc);
  
    return () => {
  
      window.removeEventListener("keydown", handleEsc);
  
    };
  
  }, []);

  return (
    <div className="flex-1">

      <p className="text-xs font-semibold text-gray-500 mb-2">
        {title}
      </p>

      <div className="relative group h-[140px] border border-dashed rounded-xl overflow-hidden bg-gray-50">

        {!image ? (
         <button
       onClick={() => inputRef.current.click()}
             className="w-full h-full flex flex-col items-center justify-center text-gray-400 hover:text-purple-600 transition"
                 >
               <ImagePlus size={28} />

                  <span className="mt-2 text-sm font-medium">
             Add Image
              </span>
         </button>
        ) : (
          <>
            <img
              src={image}
              alt=""
              className="w-full h-full object-cover"
            />

            {/* Hover */}

            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">

{/* View */}
<button
  onClick={handlePreview}
  className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-purple-600 hover:text-white transition"
>
  <Eye size={18} />
</button>

{/* Replace */}
<button
  onClick={handleReplace}
  className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-blue-600 hover:text-white transition"
>
  <Pencil size={18} />
</button>

{/* Delete */}
<button
  onClick={handleDelete}
  className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-red-600 hover:text-white transition"
>
  <Trash2 size={18} />
</button>

</div>
{showViewer && (
 <div
 className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center"
 onMouseLeave={() => setDragging(false)}
 onClick={() => setShowViewer(false)}
 onWheel={(e) => {
   e.preventDefault();

   if (e.deltaY < 0) {
     setZoom((z) => Math.min(4, z + 0.1));
   } else {
     setZoom((z) => Math.max(1, z - 0.1));
   }
 }}
>
    {/* Close Button */}
    <button
      onClick={() => setShowViewer(false)}
      className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white hover:bg-red-600 hover:text-white transition flex items-center justify-center text-2xl font-bold"
    >
      ✕
    </button>

    {/* Image */}
    <img
  src={selectedImage}
  alt="Preview"
  onClick={(e) => e.stopPropagation()}
  className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl transition"
  style={{
    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
    cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default",
  }}
  onMouseDown={(e) => {
    if (zoom <= 1) return;
  
    setDragging(true);
  
    setStartPoint({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  }}
  
  
  
  
/>
<div className="absolute bottom-8 flex items-center gap-3">

  <button
    onClick={(e) => {
      e.stopPropagation();
      setZoom((z) => Math.max(1, z - 0.25));
    }}
    className="w-10 h-10 rounded-full bg-white hover:bg-gray-200"
  >
    −
  </button>

  <span className="text-white font-semibold w-14 text-center">
    {(zoom * 100).toFixed(0)}%
  </span>

  <button
    onClick={(e) => {
      e.stopPropagation();
      setZoom((z) => Math.min(4, z + 0.25));
    }}
    className="w-10 h-10 rounded-full bg-white hover:bg-gray-200"
  >
    +
  </button>

</div>

  </div>
)}
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleSelect}
        />

      </div>

    </div>
  );
}

export default ChartCard;