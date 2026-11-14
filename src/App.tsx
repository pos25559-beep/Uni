import { MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import TourManager from './components/onboarding/TourManager';
import { loadDemoData } from './lib/demoSeed';
import Assistant from './pages/Assistant';
import Calendar from './pages/Calendar';
import CourseDetail from './pages/CourseDetail';
import Courses from './pages/Courses';
import Dashboard from './pages/Dashboard';
import {
  DeleteAccountPage,
  PrivacyPolicyPage,
  TermsOfUsePage,
} from './pages/LegalPages';
import LoginPage from './pages/Login';
import Materials from './pages/Materials';
import OnboardingPage from './pages/Onboarding';
import Planner from './pages/Planner';
import Progress from './pages/Progress';
import SettingsPage from './pages/Settings';
import WelcomePage from './pages/Welcome';

function DemoQueryBootstrap() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('demo') === '1') {
      loadDemoData();
      params.delete('demo');
      const nextSearch = params.toString();
      navigate(
        { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
        { replace: true },
      );
    }
  }, [location.pathname, location.search, navigate]);

  return null;
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <DemoQueryBootstrap />
        <TourManager />
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="bem-vindo" element={<WelcomePage />} />
            <Route path="entrar" element={<LoginPage />} />
            <Route path="configurar" element={<OnboardingPage />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="cadeiras" element={<Courses />} />
            <Route path="cadeiras/:id" element={<CourseDetail />} />
            <Route path="calendario" element={<Calendar />} />
            <Route path="plano" element={<Planner />} />
            <Route path="progresso" element={<Progress />} />
            <Route path="materiais" element={<Materials />} />
            <Route path="assistente" element={<Assistant />} />
            <Route path="definicoes" element={<SettingsPage />} />
            <Route path="definicoes/:section" element={<SettingsPage />} />
            <Route path="privacidade" element={<PrivacyPolicyPage />} />
            <Route path="termos" element={<TermsOfUsePage />} />
            <Route path="eliminar-conta" element={<DeleteAccountPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  );
}
