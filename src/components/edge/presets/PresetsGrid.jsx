import PresetCard from "./PresetCard";

export default function PresetsGrid({

  presets,

  onPreview,

}) {

  return (

    <div
      className="
        mt-5
        grid
        grid-cols-4
        gap-2
      "
    >

      {presets.map((preset)=>(

        <PresetCard

          key={preset.id}

          preset={preset}

          onPreview={onPreview}

        />

      ))}

    </div>

  );

}