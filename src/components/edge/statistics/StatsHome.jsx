import { Folder, BarChart3 } from "lucide-react";

export default function StatsHome({

  plans,

  onSelectPlan,

}) {

  const folders =
    JSON.parse(localStorage.getItem("edgeFolders")) || [];

  return (

    <div className="h-full overflow-y-auto bg-[#fafafa]">

      <div className="max-w-[1400px] mx-auto px-2 py-8">

        <h1 className="text-2xl font-bold mb-4">

          Select Trading Plan

        </h1>

        <div className="space-y-8">

          {folders.map((folder) => {

            const folderPlans = folder.plans
              .map((id) => plans.find((p) => p.id === id))
              .filter(Boolean);

            if (folderPlans.length === 0) return null;

            return (

              <div
                key={folder.id}
                className="bg-white rounded-3xl border border-gray-200 p-6"
              >

                <div className="flex items-center gap-3 mb-6">

                  <Folder
                    size={20}
                    className="text-violet-600"
                  />

                  <h2 className="text-xl font-bold">

                    {folder.name}

                  </h2>

                </div>

                <div className="grid grid-cols-2 gap-5">

                  {folderPlans.map((plan) => (

                    <button

                      key={plan.id}

                      onClick={() => onSelectPlan(plan)}

                      className="

                      p-6

                      rounded-2xl

                      border

                      border-gray-200

                      hover:border-violet-500

                      hover:shadow-lg

                      transition-all

                      text-left

                    "

                    >

                      <div className="flex items-center justify-between mb-5">

                        <div>

                          <h3 className="text-xl font-bold">

                            {plan.title}

                          </h3>

                          <p className="text-sm text-gray-500 mt-1">

                            {plan.type}

                          </p>

                        </div>

                        <BarChart3

                          size={28}

                          className="text-violet-600"

                        />

                      </div>

                      <div className="text-sm text-gray-500">

                        Open Statistics →

                      </div>

                    </button>

                  ))}

                </div>

              </div>

            );

          })}

        </div>

      </div>

    </div>

  );

}