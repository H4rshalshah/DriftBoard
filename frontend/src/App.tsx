import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuthStore, useProjectStore, useUIStore } from '@/store';
import { ScrollToTop } from '@/components/common/ScrollToTop';

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const InvitePage = lazy(() => import('@/pages/InvitePage'));
const EndpointsPage = lazy(() => import('@/pages/EndpointsPage'));
const DriftEventsPage = lazy(() => import('@/pages/DriftEventsPage'));
const SchemaHistoryPage = lazy(() => import('@/pages/SchemaHistoryPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const ApiKeysPage = lazy(() => import('@/pages/ApiKeysPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));
const Layout = lazy(() => import('@/components/layout/Layout'));

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return null;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  const theme = useUIStore((state) => state.theme);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const rehydrateSession = useAuthStore((state) => state.rehydrateSession);
  const fetchCurrentProject = useProjectStore((state) => state.fetchCurrentProject);

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      const dark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.classList.toggle('dark', dark);
      root.classList.toggle('light', !dark);
    };

    applyTheme();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    void rehydrateSession();
  }, [rehydrateSession]);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchCurrentProject();
    }
  }, [fetchCurrentProject, isAuthenticated]);

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="endpoints" element={<EndpointsPage />} />
            <Route path="drift-events" element={<DriftEventsPage />} />
            <Route path="schema-history" element={<SchemaHistoryPage />} />
            <Route path="contracts" element={<Navigate to="/app/endpoints" replace />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="api-keys" element={<ApiKeysPage />} />
            <Route path="contact" element={<ContactPage />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
