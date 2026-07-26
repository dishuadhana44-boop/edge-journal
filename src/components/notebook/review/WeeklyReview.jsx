import { useState } from "react";
import ReviewSaveBar from "./ReviewSaveBar";
import WeeklyHeader from "./WeeklyHeader";
import WeeklyStats from "./WeeklyStats";
import WeeklyGoals from "./WeeklyGoals";
import WeeklyPsychology from "./WeeklyPsychology";
import WeeklyMistakes from "./WeeklyMistakes";
import WeeklyLessons from "./WeeklyLessons";
import WeeklyActionPlan from "./WeeklyActionPlan";
import WeeklyScore from "./WeeklyScore";

import BestSetupCard from "./BestSetupCard";

export default function WeeklyReview({ onBack }) {

    const [saved,setSaved]=useState(false);

    function saveReview(){
    
        const review={
    
            week:new Date(),
    
            savedAt:new Date(),
    
        };
    
        localStorage.setItem(
    
            "weeklyReview",
    
            JSON.stringify(review)
    
        );
    
        setSaved(true);
    
    }

    return (

        <div className="h-full overflow-y-auto bg-[#fafafa]">

<button
  onClick={onBack}
  className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-100 transition"
>
  ← Back
</button>

            <div className="max-w-7xl mx-auto px-10 py-10">

            <WeeklyHeader

onBack={onBack}

onSave={saveReview}

/>

                <div className="mt-8">

                    <WeeklyStats />

                    <div className="mt-8">

    <BestSetupCard />

</div>

                </div>

                <div className="grid grid-cols-12 gap-7 mt-8">

                    {/* LEFT */}

                    <div className="col-span-8 space-y-7">

                        <WeeklyGoals />

                        <WeeklyPsychology />

                        <WeeklyMistakes />

                        <WeeklyLessons />

                    </div>

                    {/* RIGHT */}

                    <div className="col-span-4 space-y-7">

                        <WeeklyScore />

                        

                        <WeeklyActionPlan />

                        <ReviewSaveBar

saved={saved}

onSave={saveReview}

/>

                    </div>

                </div>

            </div>

        </div>

    );

}