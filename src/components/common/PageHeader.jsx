import {
    Brain,
    LayoutDashboard,
    ClipboardList,
    CandlestickChart,
    Target,
    BookOpen,
    BarChart3,
    NotebookPen,
    Newspaper,
    Settings,
    User,
  } from "lucide-react";
  
  const icons = {
    dashboard: LayoutDashboard,
    tradeLog: ClipboardList,
    trading: CandlestickChart,
    edge: Target,
    journal: BookOpen,
    reports: BarChart3,
    notebook: NotebookPen,
    news: Newspaper,
    ai: Brain,
    settings: Settings,
    profile: User,
  };
  
  export default function PageHeader({
    title,
    subtitle,
    icon = "ai",
  }) {
    const Icon = icons[icon] || Brain;
  
    return (
      <div className="flex items-center gap-3 mb-4">
  
        {/* Logo */}
        <div className="
          w-9 h-9
          rounded-xl
          bg-violet-100
          flex
          items-center
          justify-center
          shrink-0
        ">
          <Icon
            size={20}
            className="text-violet-600"
            strokeWidth={2.2}
          />
        </div>
  
        {/* Title + Subtitle SAME LINE */}
        <div className="flex items-baseline gap-3 min-w-0">
  
          <h1 className="
            text-2xl
            font-bold
            text-gray-900
            whitespace-nowrap
          ">
            {title}
          </h1>
  
          {subtitle && (
            <p className="
              text-sm
              text-gray-500
              truncate
            ">
              {subtitle}
            </p>
          )}
  
        </div>
  
      </div>
    );
  }