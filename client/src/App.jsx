import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Projects from "./pages/Projects.jsx";
import ProjectDetail from "./pages/ProjectDetail.jsx";
import Dues from "./pages/Dues.jsx";
import Partners from "./pages/Partners.jsx";

export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>المشاريع الاستثمارية</h1>
          <span>متابعة الأرباح والاستحقاقات</span>
        </div>
        <nav className="nav">
          <NavLink to="/" end>لوحة المتابعة</NavLink>
          <NavLink to="/dues">الاستحقاقات</NavLink>
          <NavLink to="/projects">المشاريع</NavLink>
          <NavLink to="/partners">الشركاء</NavLink>
        </nav>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dues" element={<Dues />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/partners" element={<Partners />} />
        </Routes>
      </main>
    </div>
  );
}
