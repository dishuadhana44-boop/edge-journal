import { useState } from "react";

import EdgeHeader from "./components/EdgeHeader";
import EdgeSidebar from "./components/EdgeSidebar";

import Overview from "./sections/Overview";
import Planner from "./sections/Planner";
import Goals from "./sections/Goals";
import Tasks from "./sections/Tasks";
import Habits from "./sections/Habits";
import Projects from "./sections/Projects";
import Learning from "./sections/Learning";
import Analytics from "./sections/Analytics";
import Reviews from "./sections/Reviews";
import AICoach from "./sections/AICoach";

export default function EdgeOS() {
  const [activePage, setActivePage] = useState("overview");

  const renderPage = () => {
    switch (activePage) {
      case "planner":
        return <Planner />;
      case "goals":
        return <Goals />;
      case "tasks":
        return <Tasks />;
      case "habits":
        return <Habits />;
      case "projects":
        return <Projects />;
      case "learning":
        return <Learning />;
      case "analytics":
        return <Analytics />;
      case "reviews":
        return <Reviews />;
      case "ai":
        return <AICoach />;
      default:
        return <Overview />;
    }
  };

  return (
    <div className=" h-screen bg-gray-50 flex flex-col">

      {/* Fixed Header */}
      <div className="flex-shrink-0 p-1 pb-0">
        <EdgeHeader />
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden p-1 ">

        {/* Fixed Sidebar */}
        <div className="w-40 flex-shrink-0">
          <EdgeSidebar
            activePage={activePage}
            setActivePage={setActivePage}
          />
        </div>

        {/* Only this scrolls */}
        <main className="flex-1 overflow-y-auto ">
          {renderPage()}
        </main>

      </div>

    </div>
  );
}