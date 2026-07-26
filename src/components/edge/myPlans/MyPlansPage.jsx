import { Search, Folder, FileText } from "lucide-react";
import { useState } from "react";
import NewFolderModal from "./NewFolderModal";
import { Plus } from "lucide-react";
import { useEffect } from "react";

export default function MyPlansPage({

  plans = [],

  onOpenPlan,

}) {

    const [showFolderModal, setShowFolderModal] = useState(false);

    const [folders, setFolders] = useState(() => {

        return JSON.parse(localStorage.getItem("edgeFolders")) || [
      
          {
            id: 1,
            name: "Commodities",
            plans: [],
          },
          {
            id: 2,
            name: "Forex",
            plans: [],
          },
          {
            id: 3,
            name: "Crypto",
            plans: [],
          },
      
        ];
      
      });

    useEffect(()=>{

        localStorage.setItem(
        
        "edgeFolders",
        
        JSON.stringify(folders)
        
        );
        
        },[folders]);

function createFolder(name) {

    const newFolder = {
  
      id: Date.now(),
  
      name,
  
      plans: [],
  
    };
  
    setFolders((prev) => [...prev, newFolder]);
  
  }

  return (

    <div className="h-full bg-[#fafafa] overflow-y-auto">

      <div className="max-w-[1400px] mx-auto p-8">

        {/* Header */}

        <div className="flex items-center justify-between mb-8">

  <div>

    <h1 className="text-2xl font-bold text-gray-900">

      My Plans

    </h1>

    

  </div>

  <button

    onClick={() => setShowFolderModal(true)}

    className="

      h-11

      px-5

      rounded-xl

      bg-violet-600

      hover:bg-violet-700

      text-white

      flex

      items-center

      gap-1

    "

  >

    <Plus size={18} />

    New Folder

  </button>

</div>
        {/* Search */}

        <div className="relative mb-8">

          <Search
            size={18}
            className="absolute left-4 top-3.5 text-gray-400"
          />

          <input

            placeholder="Search plans..."

            className="

              w-full

              h-12

              pl-11

              pr-4

              rounded-xl

              border

              border-gray-200

              bg-white

              outline-none

              focus:border-violet-500

            "

          />

        </div>

        {/* Example Folder */}

        <div className="space-y-8">

{folders.map((folder) => (

  <div

    key={folder.id}

    className="bg-white rounded-2xl border border-gray-200 p-6"

  >

    <div className="flex items-center gap-3 mb-5">

      <Folder

        className="text-violet-600"

        size={20}

      />

      <h2 className="font-bold text-lg">

        {folder.name}

      </h2>

      <span className="text-gray-400">

        ({folder.plans.length})

      </span>

    </div>

    <div className="grid grid-cols-3 gap-5">

  {folder.plans.length === 0 ? (

    <div className="col-span-3">

      <div
        className="
          h-32
          rounded-xl
          border-2
          border-dashed
          border-gray-200
          flex
          items-center
          justify-center
          text-gray-400
          bg-gray-50
        "
      >
        No Plans Yet
      </div>

    </div>

  ) : (

    folder.plans.map((plan) => (

      <button

        key={plan.id}

        onClick={() => onOpenPlan(plan)}

        className="
          border
          rounded-xl
          p-5
          hover:border-violet-500
          hover:shadow-md
          transition
          text-left
        "

      >

        <FileText
          className="text-violet-600 mb-3"
        />

        <h3 className="font-semibold">

          {plan.title}

        </h3>

      </button>

    ))

  )}

</div>

  </div>

))}

</div>

      </div>

      <NewFolderModal

  open={showFolderModal}

  onClose={() => setShowFolderModal(false)}

  onCreate={createFolder}

/>

    </div>

    

  );

}