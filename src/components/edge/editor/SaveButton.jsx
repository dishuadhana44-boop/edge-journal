import { Save } from "lucide-react";

export default function SaveButton({
    onSave,
}){
  return (
    <div className="mt-10 border-t border-gray-200 pt-6">

      <div className="flex items-center justify-between">

        <div>

        

        </div>

        <button
  onClick={onSave}
  className="h-11 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium flex items-center gap-2 transition"
>
          <Save size={18} />

          Save Plan

        </button>

      </div>

    </div>
  );
}