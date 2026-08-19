import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore, useProjectStore, useUIStore, useSocketStore } from '@/store';
import { ScrollToTop } from '@/components/common/ScrollToTop';
import { RouteLoading } from '@/components/common/RouteLoading';
import { useEnhancedScrolling } from '@/utils/smoothScroll';

// Lazy-loaded pages with prefetch hints
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
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const Layout = lazy(() => import('@/components/layout/Layout'));

// Prefetch critical pages after initial load
function useRoutePrefetching() {
  useEffect(() => {
    const prefetchRoutes = [
      () => import('@/pages/DashboardPage'),
      () => import('@/pages/EndpointsPage'),
      () => import('@/components/layout/Layout'),
    ];

    const prefetch = async () => {
      for (const route of prefetchRoutes) {
        try {
          await route();
        } catch {
          // Prefetch failure is non-critical
        }
      }
    };

    // Delay prefetching to prioritize initial render
    const timeout = setTimeout(() => { void prefetch(); }, 1000);
    return () => clearTimeout(timeout);
  }, []);
}

// Socket connection manager
function useSocketConnection() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);
  const connect = useSocketStore((state) => state.connect);
  const disconnect = useSocketStore((state) => state.disconnect);

  useEffect(() => {
    if (isAuthenticated && token) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, token, connect, disconnect]);
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <RouteLoading message="Restoring session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Page transition wrapper
function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

function SuspenseWrapper({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<RouteLoading />}>
      <PageTransition>
        {children}
      </PageTransition>
    </Suspense>
  );
}

function App() {
  const theme = useUIStore((state) => state.theme);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const rehydrateSession = useAuthStore((state) => state.rehydrateSession);
  const fetchCurrentProject = useProjectStore((state) => state.fetchCurrentProject);

  // Enable enhanced smooth scrolling
  useEnhancedScrolling();

  // Prefetch critical routes
  useRoutePrefetching();

  // Manage socket connection
  useSocketConnection();

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
        <Route path="/" element={<SuspenseWrapper><LandingPage /></SuspenseWrapper>} />
        <Route path="/login" element={<SuspenseWrapper><LoginPage /></SuspenseWrapper>} />
        <Route path="/register" element={<SuspenseWrapper><RegisterPage /></SuspenseWrapper>} />
        <Route path="/invite" element={<SuspenseWrapper><InvitePage /></SuspenseWrapper>} />
        <Route path="/invite/:token" element={<SuspenseWrapper><InvitePage /></SuspenseWrapper>} />
        <Route path="/contact" element={<SuspenseWrapper><ContactPage /></SuspenseWrapper>} />
        <Route path="/reset-password" element={<SuspenseWrapper><ResetPasswordPage /></SuspenseWrapper>} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <SuspenseWrapper>
                <Layout />
              </SuspenseWrapper>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<SuspenseWrapper><DashboardPage /></SuspenseWrapper>} />
          <Route path="endpoints" element={<SuspenseWrapper><EndpointsPage /></SuspenseWrapper>} />
          <Route path="drift-events" element={<SuspenseWrapper><DriftEventsPage /></SuspenseWrapper>} />
          <Route path="schema-history" element={<SuspenseWrapper><SchemaHistoryPage /></SuspenseWrapper>} />
          <Route path="contracts" element={<Navigate to="/app/endpoints" replace />} />
          <Route path="notifications" element={<SuspenseWrapper><NotificationsPage /></SuspenseWrapper>} />
          <Route path="settings" element={<SuspenseWrapper><SettingsPage /></SuspenseWrapper>} />
          <Route path="api-keys" element={<SuspenseWrapper><ApiKeysPage /></SuspenseWrapper>} />
          <Route path="contact" element={<SuspenseWrapper><ContactPage /></SuspenseWrapper>} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
