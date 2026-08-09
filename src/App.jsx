import { BrowserRouter, Routes, Route } from "react-router-dom";

import AppLayout from "./layouts/AppLayout";

import Dashboard from "./pages/Dashboard";
import TradeLog from "./pages/TradeLog";
import Trading from "./pages/Trading";
import Edge from "./pages/Edge";
import Journal from "./pages/Journal";
import Reports from "./pages/Reports";
import Notebook from "./pages/Notebook";
import EdgeOS from "./pages/EdgeOS/EdgeOS";
import News from "./pages/News";
import AIInsights from "./pages/AIInsights";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import TradeJournal from "./pages/TradeJournal";
import NoteEditor from "./pages/NoteEditor";
import { JournalProvider } from "./context/JournalContext";
import { DashboardFilterProvider } from "./context/DashboardFilterContext";

function App(){

    return (

        <BrowserRouter>
        
        <JournalProvider>
        
        <DashboardFilterProvider>
        
        <Routes>
        
        <Route element={<AppLayout />}>
        
        <Route path="/" element={<Dashboard />} />
        
        <Route path="/tradelog" element={<TradeLog />} />
        
        <Route path="/trading" element={<Trading />} />
        
        <Route path="/edge" element={<Edge />} />
        
        <Route path="/journal" element={<Journal />} />
        
        <Route path="/Reports" element={<Reports />} />
        
        <Route path="/notebook" element={<Notebook />} />
        
        <Route
        path="/notebook/editor/:id"
        element={<NoteEditor />}
        />
        
        <Route path="/edgeos" element={<EdgeOS />} />

        <Route path="/news" element={<News />} />
        
        <Route path="/ai" element={<AIInsights />} />
        
        <Route path="/settings" element={<Settings />} />
        
        <Route path="/profile" element={<Profile />} />
        
        <Route
        path="/trade/:id"
        element={<TradeJournal />}
        />
        
        </Route>
        
        </Routes>
        
        </DashboardFilterProvider>
        
        </JournalProvider>
        
        </BrowserRouter>
        
        );

}

export default App;