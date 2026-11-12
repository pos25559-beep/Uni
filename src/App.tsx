import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import Assistant from './pages/Assistant';
import Calendar from './pages/Calendar';
import CourseDetail from './pages/CourseDetail';
import Courses from './pages/Courses';
import Dashboard from './pages/Dashboard';
import Materials from './pages/Materials';
import Planner from './pages/Planner';
import Progress from './pages/Progress';
import SettingsPage from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="cadeiras" element={<Courses />} />
          <Route path="cadeiras/:id" element={<CourseDetail />} />
          <Route path="calendario" element={<Calendar />} />
          <Route path="plano" element={<Planner />} />
          <Route path="progresso" element={<Progress />} />
          <Route path="materiais" element={<Materials />} />
          <Route path="assistente" element={<Assistant />} />
          <Route path="definicoes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
