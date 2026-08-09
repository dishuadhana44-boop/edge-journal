import {
    Home,
    CalendarDays,
    Target,
    CheckSquare,
    Flame,
    FolderKanban,
    GraduationCap,
    BarChart3,
    ClipboardList,
    Bot,
  } from "lucide-react";
  
  import NavigationItem from "./NavigationItem";
  
  export default function EdgeSidebar({ activePage, setActivePage }) {
    const menuItems = [
      {
        id: "overview",
        title: "Overview",
        icon: Home,
      },
      {
        id: "planner",
        title: "Planner",
        icon: CalendarDays,
      },
      {
        id: "goals",
        title: "Goals",
        icon: Target,
      },
      {
        id: "tasks",
        title: "Tasks",
        icon: CheckSquare,
      },
      {
        id: "habits",
        title: "Habits",
        icon: Flame,
      },
      {
        id: "projects",
        title: "Projects",
        icon: FolderKanban,
      },
      {
        id: "learning",
        title: "Learning",
        icon: GraduationCap,
      },
      {
        id: "analytics",
        title: "Analytics",
        icon: BarChart3,
      },
      {
        id: "reviews",
        title: "Reviews",
        icon: ClipboardList,
      },
      {
        id: "ai",
        title: "AI Coach",
        icon: Bot,
      },
    ];
  
    return (
      <aside
        className="
        w-40
        bg-white
        rounded-2xl
        shadow-sm
        border
        border-gray-100
        p-4
        h-[calc(100vh-100px)]
        "
      >
        {/* Heading */}
  
        <div className="mb-6">
          <h2 className="text-xl font-bold">🚀 Edge OS</h2>
  
         
        </div>
  
        {/* Navigation */}
  
        <div className="space-y-2">
          {menuItems.map((item) => (
            <NavigationItem
              key={item.id}
              title={item.title}
              icon={item.icon}
              active={activePage === item.id}
              onClick={() => setActivePage(item.id)}
            />
          ))}
        </div>
      </aside>
    );
  }