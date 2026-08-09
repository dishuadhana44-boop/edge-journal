function DisciplineBreakdown() {
    const items = [
      {
        title: "Performance",
        score: 86,
        color: "bg-emerald-500",
      },
      {
        title: "Discipline",
        score: 78,
        color: "bg-violet-500",
      },
      {
        title: "Risk Management",
        score: 91,
        color: "bg-sky-500",
      },
      {
        title: "Consistency",
        score: 85,
        color: "bg-orange-500",
      },
      
    ];
  
    return (
      <div className="space-y-5">
  
        {items.map((item) => (
  
          <div key={item.title}>
  
            <div className="flex justify-between mb-2">
  
              <span className="text-sm font-medium text-gray-700">
                {item.title}
              </span>
  
              <span className="text-sm font-semibold text-gray-900">
                {item.score}/100
              </span>
  
            </div>
  
            <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden">
  
              <div
                className={`${item.color} h-full rounded-full transition-all duration-700`}
                style={{
                  width: `${item.score}%`,
                }}
              />
  
            </div>
  
          </div>
  
        ))}
  
      </div>
    );
  }
  
  export default DisciplineBreakdown;