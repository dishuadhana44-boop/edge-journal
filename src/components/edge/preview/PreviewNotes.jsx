export default function PreviewNotes({

    notes
    
    }){
    
    return(
    
    <div className="bg-white rounded-3xl border border-gray-200 p-7">
    
    <h2 className="text-xl font-bold mb-5">
    
    Trading Notes
    
    </h2>
    
    <div className="leading-8 whitespace-pre-wrap">
    
    {notes || "No notes available."}
    
    </div>
    
    </div>
    
    )
    
    }