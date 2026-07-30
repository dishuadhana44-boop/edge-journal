export default function PreviewHeader({ plan }) {

    return (
    
    <div className="bg-white rounded-3xl border border-gray-200 p-7 shadow-sm">
    
    <div className="flex justify-between items-start">
    
    <div>
    
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-sm font-semibold">
    
    {plan.type || "Trading Plan"}
    
    </div>
    
    <h1 className="mt-4 text-3xl font-bold">
    
    {plan.title}
    
    </h1>
    
    </div>
    
    <div className="text-right text-sm text-gray-500">
    
    <div>
    
    Created
    
    </div>
    
    <div>
    
    {new Date(plan.createdAt).toLocaleDateString()}
    
    </div>
    
    <div className="mt-3">
    
    Updated
    
    </div>
    
    <div>
    
    {new Date(plan.updatedAt).toLocaleDateString()}
    
    </div>
    
    </div>
    
    </div>
    
    </div>
    
    );
    
    }