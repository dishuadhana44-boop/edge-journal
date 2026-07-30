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
import WeeklyAISummary from "./WeeklyAISummary";
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

        <div className="h-full overflow-y-auto bg-[#F8F9FC]">
        
        <div className="max-w-[1700px] mx-auto   space-y-2">
        
            {/* HEADER */}
        
            <WeeklyHeader
                onBack={onBack}
                onSave={saveReview}
            />
        
            {/* STATS */}
        
            <WeeklyStats />
        
            {/* BEST SETUP */}
        
            <BestSetupCard />
        
            {/* ================= ROW 1 ================= */}
        
            <div className="grid grid-cols-12 gap-4">
        
                <div className="col-span-8">
        
                    <WeeklyGoals />
        
                </div>
        
                <div className="col-span-4">
        
                    <WeeklyScore />
        
                </div>
        
            </div>
        
            {/* ================= ROW 2 ================= */}
        
            <div className="grid grid-cols-12 gap-4">
        
                <div className="col-span-8">
        
                    <WeeklyPsychology />
        
                </div>
        
                <div className="col-span-4">
        
                    <ReviewSaveBar
                        saved={saved}
                        onSave={saveReview}
                    />
        
                </div>
        
            </div>
        
            {/* ================= ROW 3 ================= */}
        
            <div className="grid grid-cols-12 gap-8">
        
                <div className="col-span-8">
        
                    <WeeklyMistakes />
        
                </div>
        
                <div className="col-span-4">
        
                    <WeeklyActionPlan />
        
                </div>
        
            </div>
        
            {/* ================= FULL WIDTH ================= */}
        
            <WeeklyLessons />
        
        </div>
        
        </div>
        
        );

}