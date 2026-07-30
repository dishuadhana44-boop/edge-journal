export default function PreviewTags({

    tags=[]
    
    }){
    
    return(
    
    <div className="bg-white rounded-3xl border border-gray-200 p-7">
    
    <h2 className="text-xl font-bold mb-5">
    
    Checklist Tags
    
    </h2>
    
    {tags.length===0?
    
    <div className="text-gray-400">
    
    No Tags
    
    </div>
    
    :
    
    <div className="flex flex-wrap gap-3">
    
    {tags.map((tag,index)=>(
    
    <div
    
    key={index}
    
    className="
    
    px-4
    
    py-2
    
    rounded-full
    
    bg-violet-100
    
    text-violet-700
    
    font-medium
    
    "
    
    >
    
    {tag}
    
    </div>
    
    ))}
    
    </div>
    
    }
    
    </div>
    
    )
    
    }