import { ImagePlus, Trash2 } from "lucide-react";


function UploadCard({
    title,
    image,
    onUpload,
    onRemove,
  }) {
  
    function handleFile(e) {
  
      const file = e.target.files[0];
  
      if (!file) return;
  
      const reader = new FileReader();
  
      reader.onload = () => {
        onUpload(reader.result);
      };
  
      reader.readAsDataURL(file);
    }
  
    return (
      <div>
  
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          {title}
        </p>
  
        {image ? (
  
          <div className="relative">
  
            <img
              src={image}
              className="w-full h-52 rounded-xl object-cover border"
            />
  
            <button
              onClick={onRemove}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center"
            >
              <Trash2
                size={18}
                className="text-red-500"
              />
            </button>
  
          </div>
  
        ) : (
  
          <label className="w-full h-52 rounded-xl border-2 border-dashed border-gray-300 hover:border-purple-500 hover:bg-purple-50 transition flex flex-col items-center justify-center cursor-pointer">
  
            <ImagePlus
              size={30}
              className="text-gray-400 mb-3"
            />
  
            <p className="font-medium">
              Upload Image
            </p>
  
            <p className="text-xs text-gray-400 mt-1">
              Click to Upload
            </p>
  
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={handleFile}
            />
  
          </label>
  
        )}
  
      </div>
    );
  }

export default function EntryModels({
    strategy,
    setStrategy,
}) {
  return (
    <div className="mb-8">

      <div className="mb-4">

        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Entry Models
        </h3>

      </div>

      <div className="grid grid-cols-2 gap-6">

      <UploadCard
    title="Setup Example"

    image={strategy.setupImage}

    onUpload={(img)=>
        setStrategy({
            ...strategy,
            setupImage: img,
        })
    }

    onRemove={()=>
        setStrategy({
            ...strategy,
            setupImage:"",
        })
    }
/>

<UploadCard
    title="Entry Example"

    image={strategy.entryImage}

    onUpload={(img)=>
        setStrategy({
            ...strategy,
            entryImage: img,
        })
    }

    onRemove={()=>
        setStrategy({
            ...strategy,
            entryImage:"",
        })
    }
/>

      </div>

    </div>
  );
}