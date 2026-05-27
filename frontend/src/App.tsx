import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore, useProjectStore, useUIStore } from '@/store';
import LandingPage from '@/pages/LandingPage';
import DashboardPage from '@/pages/DashboardPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import InvitePage from '@/pages/InvitePage';
import EndpointsPage from '@/pages/EndpointsPage';
import DriftEventsPage from '@/pages/DriftEventsPage';
import SchemaHistoryPage from '@/pages/SchemaHistoryPage';
import SettingsPage from '@/pages/SettingsPage';
import NotificationsPage from '@/pages/NotificationsPage';
import ApiKeysPage from '@/pages/ApiKeysPage';
import ContactPage from '@/pages/ContactPage';
import ContractsPage from '@/pages/ContractsPage';
import Layout from '@/components/layout/Layout';
import { ScrollToTop } from '@/components/common/ScrollToTop';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
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
          <Route path="contracts" element={<ContractsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="api-keys" element={<ApiKeysPage />} />
          <Route path="contact" element={<ContactPage />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
