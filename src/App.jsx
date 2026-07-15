import { BrowserRouter, Routes, Route } from "react-router-dom";

import AppLayout from "./layouts/AppLayout";

import Dashboard from "./pages/Dashboard";
import TradeLog from "./pages/TradeLog";
import Trading from "./pages/Trading";
import Edge from "./pages/Edge";
import Journal from "./pages/Journal";
import Reports from "./pages/Reports";
import Notebook from "./pages/Notebook";
import News from "./pages/News";
import AIInsights from "./pages/AIInsights";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import TradeJournal from "./pages/TradeJournal";
import NoteEditor from "./pages/NoteEditor";

function App(){

return(

<BrowserRouter>

<Routes>

<Route element={<AppLayout/>}>

<Route path="/" element={<Dashboard/>}/>

<Route path="/tradelog" element={<TradeLog />} />

<Route path="/trading" element={<Trading/>}/>

<Route path="/edge" element={<Edge/>}/>

<Route path="/journal" element={<Journal/>}/>

<Route path="/Reports" element={<Reports/>}/>

<Route path="/notebook" element={<Notebook/>}/>
<Route path="/notebook/editor/:id" element={<NoteEditor />} />

<Route path="/news" element={<News/>}/>

<Route path="/ai" element={<AIInsights/>}/>

<Route path="/settings" element={<Settings/>}/>

<Route path="/profile" element={<Profile/>}/>

<Route path="/trade/:id" element={<TradeJournal />} />

</Route>

</Routes>

</BrowserRouter>

)

}

export default App;