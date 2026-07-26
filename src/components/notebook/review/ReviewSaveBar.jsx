import { Save, CheckCircle2 } from "lucide-react";

export default function ReviewSaveBar({

    onSave,

    saved,

}) {

    return (

        <div className="sticky bottom-6 z-20">

            <div className="rounded-3xl bg-white border border-gray-200 shadow-xl p-5 flex items-center justify-between">

                <div>

                    <p className="font-semibold text-lg">

                        {saved
                            ? "Weekly Review Saved"
                            : "Unsaved Changes"}

                    </p>

                    <p className="text-gray-500 text-sm mt-1">

                        {saved
                            ? "Everything has been stored locally."
                            : "Don't forget to save your review."}

                    </p>

                </div>

                <button

                    onClick={onSave}

                    className={`px-6 h-12 rounded-2xl flex items-center gap-2 transition-all duration-300

                    ${saved

                        ? "bg-green-500 text-white"

                        : "bg-purple-600 hover:bg-purple-700 text-white"

                    }

                    `}

                >

                    {saved
                        ? <CheckCircle2 size={20}/>
                        : <Save size={20}/>
                    }

                    {saved
                        ? "Saved"
                        : "Save Review"
                    }

                </button>

            </div>

        </div>

    )

}