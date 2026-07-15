import {
    Type,
    FileText,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    CheckSquare,
    ChevronRight,
    Quote,
    MessageSquareQuote,
    Minus,
  
    Table,
    Database,
    KanbanSquare,
    Calendar,
    GanttChart,
    LayoutGrid,
  
    Image,
    Video,
    Music,
    File,
    Bookmark,
    Globe,
  
    Code2,
    Sigma,
    ListTree,
    Navigation,
    Columns2,
    Copy,
  
    Sparkles,
    Languages,
    Brain,
  } from "lucide-react";

export const slashItems = [
    {
      category: "Basic",
      items: [
        { title: "Text", icon: Type },
        { title: "Page", icon: FileText },
      
        { title: "Heading 1", icon: Heading1 },
        { title: "Heading 2", icon: Heading2 },
        { title: "Heading 3", icon: Heading3 },
      
        { title: "Bullet List", icon: List },
        { title: "Numbered List", icon: ListOrdered },
      
        { title: "To-do", icon: CheckSquare },
      
        { title: "Toggle", icon: ChevronRight },
      
        { title: "Quote", icon: Quote },
      
        { title: "Callout", icon: MessageSquareQuote },
      
        { title: "Divider", icon: Minus },
      ],
    },
  
    {
        category: "Database",
        items: [
          { title: "Table", icon: Table },
          { title: "Database", icon: Database },
          { title: "Board", icon: KanbanSquare },
          { title: "Calendar", icon: Calendar },
          { title: "Timeline", icon: GanttChart },
          { title: "Gallery", icon: LayoutGrid },
        ],
      },

      {
        category: "Media",
        items: [
          { title: "Image", icon: Image },
          { title: "Video", icon: Video },
          { title: "Audio", icon: Music },
          { title: "File", icon: File },
          { title: "Bookmark", icon: Bookmark },
          { title: "Embed", icon: Globe },
        ],
      },

   {
  category: "Advanced",
  items: [
    { title: "Code", icon: Code2 },
    { title: "Equation", icon: Sigma },
    { title: "Table of Contents", icon: ListTree },
    { title: "Breadcrumb", icon: Navigation },
    { title: "Columns", icon: Columns2 },
    { title: "Synced Block", icon: Copy },
  ],
},
  
{
    category: "AI",
    items: [
      { title: "AI Writing", icon: Sparkles },
      { title: "AI Translate", icon: Languages },
      { title: "AI Summarize", icon: Brain },
    ],
  },
  ];