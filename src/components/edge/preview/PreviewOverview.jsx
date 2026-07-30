import {
    Folder,
    Calendar,
    Tag,
    Clock3,
  } from "lucide-react";
  
  export default function PreviewOverview({ plan }) {
    return (
      <div className="bg-white rounded-3xl border border-gray-200 p-7 shadow-sm">
  
        <h2 className="text-xl  text-gray-800 font-bold mb-6">
          Plan Overview
        </h2>
  
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
  
          <div className="rounded-2xl bg-gray-50 p-5">
  
            <Folder
              className="text-violet-600 mb-3"
              size={22}
            />
  
            <div className="text-xs text-gray-500">
              Plan Type
            </div>
  
            <div className="font-semibold mt-1">
              {plan.type || "-"}
            </div>
  
          </div>
  
          <div className="rounded-2xl bg-gray-50 p-5">
  
            <Tag
              className="text-violet-600 mb-3"
              size={22}
            />
  
            <div className="text-xs text-gray-500">
              Checklist Tags
            </div>
  
            <div className="font-semibold mt-1">
              {plan.checklistTags?.length || 0}
            </div>
  
          </div>
  
          <div className="rounded-2xl bg-gray-50 p-5">
  
            <Calendar
              className="text-violet-600 mb-3"
              size={22}
            />
  
            <div className="text-xs text-gray-500">
              Created
            </div>
  
            <div className="font-semibold mt-1">
              {plan.createdAt
                ? new Date(plan.createdAt).toLocaleDateString()
                : "-"}
            </div>
  
          </div>
  
          <div className="rounded-2xl bg-gray-50 p-5">
  
            <Clock3
              className="text-violet-600 mb-3"
              size={22}
            />
  
            <div className="text-xs text-gray-500">
              Updated
            </div>
  
            <div className="font-semibold mt-1">
              {plan.updatedAt
                ? new Date(plan.updatedAt).toLocaleDateString()
                : "-"}
            </div>
  
          </div>
  
        </div>
  
      </div>
    );
  }