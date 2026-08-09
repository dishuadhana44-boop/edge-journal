import logo from "../assets/logo.png";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BookText,
  TrendingUp,
  BookOpen,
  Sparkles,
  ChartBar,
  Notebook,
  Rocket,
  Newspaper,
  Brain,
  PanelLeft,
  Sun,
  Moon,
  Settings,
  User
  } from "lucide-react";

  function Sidebar({ collapsed, setCollapsed }) {
  const navigate = useNavigate();
  
  const [darkMode, setDarkMode] = useState(false);
  return(
  
    <div
    className={`
    ${collapsed ? "w-13" : "w-32"}
    bg-white
    min-h-screen
    fixed
    left-0
    top-0
    bottom-3
    rounded-2xl
    shadow-[0_8px_30px_rgba(0,0,0,0.08)]
    p-2
    text-black
    flex
    flex-col
    transition-all
    duration-300
    `}
    >
  
  
  {/* logo area */}
  
  <div
  className={`flex items-center transition-all duration-300 ${
    collapsed
      ? "justify-center mt-3 mb-6 ml-0"
      : "-space-x-1 mb-0 -ml-7 -mt-6"
  }`}
>
  
<div className={`${collapsed ? "w-10 h-10" : ""} flex items-center justify-center`}>
  <img
    src={logo}
    className={`object-contain transition-all duration-300 ${
      collapsed ? "w-10 h-10 scale-225" : "w-23 h-23"
    }`}
  />
</div>
{!collapsed && (
  
  <div className="-ml-2">
  
  <h1 className="text-50px font-bold">
  EDGE
  </h1>
  
  
  <h2 className="
  text-100px
  font-bold
  text-purple-600
  mt-0
  finder-glow
  ">
  FINDER
  </h2>
  
  
  </div>
  
)}
  
  </div>
  
  
  
  <div className="flex flex-col h-full justify-between">


{/* TOP FEATURES */}

<div className="space-y-5">


<div
  onClick={() => navigate("/")}
  className={`
    flex
    items-center
    text-sm
    font-medium
    cursor-pointer
    ${collapsed ? "justify-center" : "gap-3"}
  `}
>
  <LayoutDashboard size={18} />
  {!collapsed && "Dashboard"}
</div>

<div
  onClick={() => navigate("/tradelog")}
  className={`
    flex
    items-center
    text-sm
    font-medium
    cursor-pointer
    ${collapsed ? "justify-center" : "gap-3"}
  `}
>
  <BookText size={18} />
  {!collapsed && "Trade Log"}
</div>

<div
  onClick={() => navigate("/trading")}className={`
flex
items-center
text-sm
font-medium
cursor-pointer
${collapsed ? "justify-center" : "gap-3"}
`} >
<TrendingUp size={18}/>
{!collapsed && "Trading"}
</div>


<div
  onClick={() => navigate("/edge")} className={`
flex
items-center
text-sm
font-medium
cursor-pointer
${collapsed ? "justify-center" : "gap-3"}
`}>
<Sparkles size={18}/>
{!collapsed && "Edge"}
</div>


<div onClick={() => navigate("/journal")}
className={`
flex
items-center
text-sm
font-medium
cursor-pointer
${collapsed ? "justify-center" : "gap-3"}
`}>
<BookOpen size={18}/>
{!collapsed && "Journal"}
</div>


<div onClick={() => navigate("/reports")}
className={`
flex
items-center
text-sm
font-medium
cursor-pointer
${collapsed ? "justify-center" : "gap-3"}
`}>
<ChartBar size={18}/>
{!collapsed && "Reports"}
</div>


<div onClick={() => navigate("/notebook")}
 className={`
flex
items-center
text-sm
font-medium
cursor-pointer
${collapsed ? "justify-center" : "gap-3"}
`}>
<Notebook size={18}/>
{!collapsed && "Notebook"}
</div>

<div onClick={() => navigate("/EdgeOS")}
 className={`
flex
items-center
text-sm
font-medium
cursor-pointer
${collapsed ? "justify-center" : "gap-3"}
`}>
<Rocket size={18}/>
{!collapsed && "EdgeOS"}
</div>



<div onClick={() => navigate("/news")}
className={`
flex
items-center
text-sm
font-medium
cursor-pointer
${collapsed ? "justify-center" : "gap-3"}
`}>
<Newspaper size={18}/>
{!collapsed && "News"}
</div>


<div onClick={() => navigate("/ai")}
className={`
flex
items-center
text-sm
font-medium
cursor-pointer
${collapsed ? "justify-center" : "gap-3"}
`}>
<Brain size={18}/>
{!collapsed && "AI Insights"}
</div>


</div>



{/* BOTTOM FEATURES */}

<div className="space-y-5">


<div
  onClick={() => setCollapsed(!collapsed)}
  className={`
    flex
    items-center
    text-sm
    font-medium
    cursor-pointer
    ${collapsed ? "justify-center" : "gap-3"}
    `}
>
<PanelLeft size={18}/>
{!collapsed && "Collapse"}
</div>


<div className={`
flex
items-center
text-sm
font-medium
cursor-pointer
${collapsed ? "justify-center" : "gap-3"}
`}>
<Sun size={18}/>
{!collapsed && "Theme"}
</div>


<div onClick={() => navigate("/settings")}
className={`
flex
items-center
text-sm
font-medium
cursor-pointer
${collapsed ? "justify-center" : "gap-3"}
`}>
<Settings size={18}/>
{!collapsed && "Settings"}
</div>


<div onClick={() => navigate("/profile")} 
className={`
flex
items-center
text-sm
font-medium
cursor-pointer
${collapsed ? "justify-center" : "gap-3"}
`}>
<User size={18}/>
{!collapsed && "Profile"}
</div>


</div>


</div>

</div>

  )
  
  }


export default Sidebar;