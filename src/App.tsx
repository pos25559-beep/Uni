import { MotionConfig } from 'motion/react';
import { Suspense, lazy, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import LoadingUnis from './components/brand/LoadingUnis';
import { UnipediaLogoMark } from './components/brand/UnipediaMarks';
import { loadDemoData } from './lib/demoSeed';

const TourManager = lazy(() => import('./components/onboarding/TourManager'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const WelcomePage = lazy(() => import('./pages/Welcome'));
const LoginPage = lazy(() => import('./pages/Login'));
const OnboardingPage = lazy(() => import('./pages/Onboarding'));
const Courses = lazy(() => import('./pages/Courses'));
const CourseDetail = lazy(() => import('./pages/CourseDetail'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Planner = lazy(() => import('./pages/Planner'));
const Progress = lazy(() => import('./pages/Progress'));
const Materials = lazy(() => import('./pages/Materials'));
const Assistant = lazy(() => import('./pages/Assistant'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const DeleteAccountPage = lazy(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.DeleteAccountPage })),
);
const PrivacyPolicyPage = lazy(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.PrivacyPolicyPage })),
);
const TermsOfUsePage = lazy(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.TermsOfUsePage })),
);

function RouteLoadingFallback() {
  const { t } = useTranslation('common');
  const { pathname } = useLocation();

  const variant = pathname.startsWith('/cadeiras')
    ? 'courses'
    : pathname.startsWith('/progresso')
      ? 'grades'
      : pathname.startsWith('/materiais')
        ? 'materials'
        : null;

  if (variant) {
    return (
      <div className="grid min-h-[45vh] place-items-center py-12">
        <LoadingUnis variant={variant} />
      </div>
    );
  }

  return (
    <div className="grid min-h-[45vh] place-items-center py-12 text-muted">
      <div className="flex flex-col items-center gap-3">
        <UnipediaLogoMark size={38} />
        <span className="text-xs font-medium">{t('loadingPage')}</span>
      </div>
    </div>
  );
}

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
        <Suspense fallback={null}>
          <TourManager />
        </Suspense>
        <Suspense fallback={<RouteLoadingFallback />}>
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
        </Suspense>
      </BrowserRouter>
    </MotionConfig>
  );
}
