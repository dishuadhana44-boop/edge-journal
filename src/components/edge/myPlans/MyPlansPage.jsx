import { Search, Folder, FileText } from "lucide-react";
import { useState } from "react";
import NewFolderModal from "./NewFolderModal";
import { Plus } from "lucide-react";
import { useEffect } from "react";
import PlanCard from "./PlanCard";
import { Trash2 } from "lucide-react";

export default function MyPlansPage({

    plans,
  
    onOpenPlan,
  
    onPreview,
  
  }) {

    const [showFolderModal, setShowFolderModal] = useState(false);

    const [folders, setFolders] = useState(() => {
      return (
        JSON.parse(localStorage.getItem("edgeFolders")) || [
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
        ]
      );
    });
    
    const [allPlans, setAllPlans] = useState(() => {
      return JSON.parse(
        localStorage.getItem("edgeStrategies")
      ) || [];
    });

    useEffect(()=>{

        localStorage.setItem(
        
        "edgeFolders",
        
        JSON.stringify(folders)
        
        );
        
        },[folders]);

        useEffect(() => {

          const savedPlans =
            JSON.parse(localStorage.getItem("edgeStrategies")) || [];
        
          setAllPlans(savedPlans);
        
        }, []);

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

<div className="max-w-[1500px] mx-auto px-4 pt-3 pb-8">

        {/* Header */}

        <div className="flex items-center justify-between mb-5">

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

        <div className="relative mb-4">

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

        <div className="space-y-2">

{folders.map((folder) => (

  <div

    key={folder.id}

    className="bg-white rounded-2xl border border-gray-200 p-5"

  >

<div className="flex items-center justify-between mb-5">

<div className="flex items-center gap-3">

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

<button

  onClick={() => {

    const ok = window.confirm(

      `Delete folder "${folder.name}"?`

    );

    if (!ok) return;

    const updatedFolders = folders.filter(

      (f) => f.id !== folder.id

    );

    setFolders(updatedFolders);

    localStorage.setItem(

      "edgeFolders",

      JSON.stringify(updatedFolders)

    );

  }}

  className="

    w-9

    h-9

    rounded-lg

    flex

    items-center

    justify-center

    text-red-500

    hover:bg-red-50

    hover:text-red-600

    transition

  "

  title="Delete Folder"

>

  <Trash2 size={18} />

</button>

</div>

    <div className="grid grid-cols-2 gap-6">

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

    folder.plans
  .map((planId) =>
    allPlans.find((p) => p.id === planId)
  )
  .filter(Boolean)
  .map((plan) => (

        <PlanCard
      
          key={plan.id}
      
          plan={plan}
      
          onPreview={(plan) => {

            onPreview(plan);
        
        }}
      
          onEdit={(plan) => {
      
            onOpenPlan(plan);
      
          }}
      
          onDelete={(plan) => {

            if (!window.confirm(`Delete "${plan.title}" ?`))
                return;
        
            // Folder update
        
            const updatedFolders = folders.map((f) => {
        
                if (f.id !== folder.id) return f;
        
                return {
        
                    ...f,
        
                    plans: f.plans.filter(
                      (id) => id !== plan.id
                  )
        
                };
        
            });
        
            setFolders(updatedFolders);
        
            localStorage.setItem(
        
                "edgeFolders",
        
                JSON.stringify(updatedFolders)
        
            );
        
            // edgeStrategies update
        
            const allStrategies =
        
                JSON.parse(localStorage.getItem("edgeStrategies")) || [];
        
            const updatedStrategies = allStrategies.filter(
        
                (item) => item.id !== plan.id
        
            );
        
            localStorage.setItem(
        
                "edgeStrategies",
        
                JSON.stringify(updatedStrategies)
        
            );
        
        }}
      
        />
      
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