import { useState } from "react";
import ChecklistEditor from "./ChecklistEditor";
import StrategyInfo from "./StrategyInfo";
import ChecklistTags from "./ChecklistTags";
import EntryCriteria from "./EntryCriteria";
import EntryModels from "../EntryModels";
import TradeManagement from "./TradeManagement";
import ExitCriteria from "./ExitCriteria";
import TradingNotes from "./TradingNotes";
import CancelButton from "./CancelButton";
import SaveButton from "./SaveButton";
import FolderSelectModal from "../myPlans/modals/FolderSelectModal";



export default function EdgeEditor({

  mode = "new",

  strategy: editingStrategy = null,

  onClose,

}) {
  const [strategy, setStrategy] = useState(

    editingStrategy || {

        id: null,

        title: "",

        type: "",

        checklistTags: [],

        chartingProcess: [],

        entryCriteria: [],

        exitCriteria: [],

        managementRules: [],

        notes: "",

        setupImage: "",

        entryImage: "",

        createdAt: "",

        updatedAt: "",

    }

);

const [showFolderModal, setShowFolderModal] = useState(false);

const [folders, setFolders] = useState(
  JSON.parse(localStorage.getItem("edgeFolders")) || []
);

function saveStrategy(selectedFolder) {

        console.log("SAVE BUTTON CLICKED");
      
        const allStrategies =
          JSON.parse(localStorage.getItem("edgeStrategies")) || [];
      
        // Update existing strategy
        if (strategy.id) {
      
          const updated = allStrategies.map((item) =>
            item.id === strategy.id
              ? {
                  ...strategy,
                  updatedAt: new Date().toISOString(),
                }
              : item
          );
      
          localStorage.setItem(
            "edgeStrategies",
            JSON.stringify(updated)
          );
      
          alert("Plan Updated");
          if (onClose) {
    onClose();
}
      
          return;
        }
      
        // Create new strategy


const newStrategy = {

  ...strategy,

  id: Date.now(),

  createdAt: new Date().toISOString(),

  updatedAt: new Date().toISOString(),

};

// Save Strategy
const updatedStrategies = [
  ...allStrategies,
  newStrategy,
];

localStorage.setItem(
  "edgeStrategies",
  JSON.stringify(updatedStrategies)
);

// Update Folder Mapping
const allFolders =
  JSON.parse(localStorage.getItem("edgeFolders")) || [];

const updatedFolders = allFolders.map((folder) => {

  if (folder.id === selectedFolder.id) {

    return {

      ...folder,

      plans: [...folder.plans, newStrategy],

    };

  }

  return folder;

});

localStorage.setItem(
  "edgeFolders",
  JSON.stringify(updatedFolders)
);

alert(`Saved to "${selectedFolder.name}"`);

if (onClose) {
  onClose();
}
      }

  return (
    <div className="flex-1 bg-white rounded-2xl border border-gray-200 p-8 overflow-y-auto">

<div className="space-y-10">

<StrategyInfo
    strategy={strategy}
    setStrategy={setStrategy}
/>

<ChecklistEditor
  title="Charting Process"
  placeholder="Type charting step and press Enter..."
  items={strategy.chartingProcess}
  onChange={(data) =>
    setStrategy({
      ...strategy,
      chartingProcess: data,
    })
  }
/>

<ChecklistEditor
  title="Entry Criteria"
  placeholder="Type entry condition..."
  items={strategy.entryCriteria}
  onChange={(data) =>
    setStrategy({
      ...strategy,
      entryCriteria: data,
    })
  }
/>

<EntryModels
    strategy={strategy}
    setStrategy={setStrategy}
/>

<TradeManagement
    strategy={strategy}
    setStrategy={setStrategy}
/>

      <ChecklistEditor
  title="Exit Criteria"
  placeholder="Type exit condition..."
  items={strategy.exitCriteria}
  onChange={(data) =>
    setStrategy({
      ...strategy,
      exitCriteria: data,
    })
  }
/>

<TradingNotes
    strategy={strategy}
    setStrategy={setStrategy}
/>

<div className="flex justify-end gap-4 pt-6">

  <CancelButton
    onClick={onClose}
  />

<SaveButton
  onSave={() => setShowFolderModal(true)}
/>
</div>

      </div>

      <FolderSelectModal

open={showFolderModal}

folders={folders}

onClose={() => setShowFolderModal(false)}

onSelect={(folder) => {

  saveStrategy(folder);

  setShowFolderModal(false);

}}

/>

    </div>
    
  );

}