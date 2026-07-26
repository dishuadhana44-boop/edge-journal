import { useState } from "react";
import PresetPreview from "../presetPreview/PresetPreview";
import PresetsHeader from "./PresetsHeader";
import PresetsGrid from "./PresetsGrid";
import presets from "./presetsData";

export default function PresetsPage() {
  const [selectedPreset, setSelectedPreset] = useState(null);

  if (selectedPreset) {
    return (
      <PresetPreview
        preset={selectedPreset}
        onBack={() => setSelectedPreset(null)}
      />
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto hide-scrollbar scroll-smooth">

      <div className="max-w-[1700px] mx-auto px-3 py-8">

        <PresetsHeader />

        <PresetsGrid

    presets={presets}

    onPreview={setSelectedPreset}

/>

      </div>

    </div>
  );
}