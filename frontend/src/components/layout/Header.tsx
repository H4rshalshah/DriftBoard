import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Bell, FileWarning, Info, Menu, Search } from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useAuthStore, useNotificationStore, useUIStore } from '@/store';
import { cn } from '@/utils/cn';

interface Breadcrumb {
  label: string;
  path?: string;
}

const breadcrumbMap: Record<string, Breadcrumb[]> = {
  '/app/dashboard': [{ label: 'Dashboard' }],
  '/app/endpoints': [{ label: 'Dashboard', path: '/app/dashboard' }, { label: 'Endpoints' }],
  '/app/drift-events': [{ label: 'Dashboard', path: '/app/dashboard' }, { label: 'Drift Events' }],
  '/app/schema-history': [{ label: 'Dashboard', path: '/app/dashboard' }, { label: 'Schema History' }],
  '/app/notifications': [{ label: 'Dashboard', path: '/app/dashboard' }, { label: 'Notifications' }],
  '/app/settings': [{ label: 'Dashboard', path: '/app/dashboard' }, { label: 'Settings' }],
  '/app/api-keys': [{ label: 'Dashboard', path: '/app/dashboard' }, { label: 'API Keys' }],
  '/app/contact': [{ label: 'Dashboard', path: '/app/dashboard' }, { label: 'Contact' }],
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { sidebarCollapsed, sidebarOpen, setSidebarOpen, commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();
  const { user, logout } = useAuthStore();
  const [searchFocused, setSearchFocused] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (event.key === 'Escape') {
        setNotificationsOpen(false);
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (notificationsOpen && notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (userMenuOpen && userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [notificationsOpen, userMenuOpen]);

  const breadcrumbs = breadcrumbMap[location.pathname] || [{ label: 'Dashboard' }];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'drift':
        return <AlertCircle className="h-4 w-4 text-amber-400" />;
      case 'schema':
        return <FileWarning className="h-4 w-4 text-primary-400" />;
      case 'system':
        return <Info className="h-4 w-4 text-white/40" />;
      default:
        return <Bell className="h-4 w-4 text-white/40" />;
    }
  };

  const notificationTarget = (notification: { type: string; actionUrl?: string }) => {
    if (notification.actionUrl) return notification.actionUrl;
    if (notification.type === 'drift') return '/app/drift-events';
    if (notification.type === 'schema') return '/app/schema-history';
    if (notification.type === 'system') return '/app/api-keys';
    if (notification.type === 'team' || notification.type === 'member') return '/app/settings';
    return '/app/notifications';
  };

  return (
    <header
      className={cn(
        'app-header-surface fixed right-0 top-0 z-30 h-16 backdrop-blur-lg transition-all duration-300',
        sidebarCollapsed ? 'left-0 lg:left-[96px]' : 'left-0 lg:left-[260px]'
      )}
    >
      <div className="flex h-full items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="grid h-10 w-10 place-items-center rounded-lg text-neutral-400 dark:text-white/40 transition-colors hover:bg-white dark:hover:bg-white dark:bg-white/5 hover:text-neutral-700 dark:hover:text-white/70 lg:hidden"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <nav className="hidden items-center gap-2 text-sm sm:flex">
            {breadcrumbs.map((crumb, index) => (
              <div key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                {index > 0 && <span className="text-white/15">/</span>}
                {crumb.path ? (
                  <Link to={crumb.path} className="text-neutral-400 dark:text-white/40 transition-colors hover:text-neutral-700 dark:hover:text-white/70">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-medium text-neutral-800 dark:text-white/80">{crumb.label}</span>
                )}
              </div>
            ))}
          </nav>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 md:gap-3">
          <div className="relative hidden min-w-[220px] max-w-sm flex-1 md:block">
            <motion.div
              animate={{
                borderColor: searchFocused ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.06)',
              }}
              className="flex w-full items-center gap-2 rounded-lg border bg-neutral-50 dark:bg-white dark:bg-white/[0.03] px-3 py-2 transition-colors duration-200"
            >
              <Search className="h-4 w-4 text-neutral-400 dark:text-white/30" />
              <input
                type="text"
                placeholder="Search endpoints, drifts, keys..."
                className="min-w-0 flex-1 bg-transparent text-sm text-neutral-800 dark:text-white/80 outline-none placeholder:text-neutral-400 dark:placeholder:text-white/25"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              <kbd className="hidden rounded bg-neutral-200 dark:bg-white dark:bg-white/[0.06] px-2 py-0.5 text-[11px] text-neutral-500 dark:text-white/30 lg:inline-flex">
                Ctrl K
              </kbd>
            </motion.div>
          </div>

          <ThemeToggle className="h-9 w-[64px] flex-shrink-0" />

          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative rounded-lg p-2 text-neutral-400 dark:text-white/40 transition-colors hover:bg-white dark:hover:bg-white dark:bg-white/5 hover:text-neutral-700 dark:hover:text-white/70"
              aria-label="Open notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  className="notification-popover absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl border shadow-xl"
                >
                  <div className="notification-popover-header flex items-center justify-between border-b px-4 py-3">
                    <h3 className="text-sm font-semibold text-neutral-800 dark:text-white">Notifications</h3>
                    {unreadCount > 0 && (
                      <button onClick={() => markAllAsRead()} className="text-xs text-primary-400 transition-colors hover:text-primary-300">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto scrollbar-thin">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-neutral-400 dark:text-white/30">No notifications</div>
                    ) : (
                      notifications.slice(0, 5).map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => {
                            void markAsRead(notification.id);
                            setNotificationsOpen(false);
                            navigate(notificationTarget(notification));
                          }}
                          className={cn(
                            'notification-popover-row flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150',
                            !notification.read && 'notification-popover-row-unread'
                          )}
                        >
                          <div className="mt-0.5 flex-shrink-0">{getNotificationIcon(notification.type)}</div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-neutral-800 dark:text-white/80">{notification.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500 dark:text-white/35">{notification.message}</p>
                          </div>
                          {!notification.read && <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" />}
                        </button>
                      ))
                    )}
                  </div>
                  <Link
                    to="/app/notifications"
                    onClick={() => setNotificationsOpen(false)}
                    className="notification-popover-footer block border-t px-4 py-3 text-center text-sm text-primary-400 transition-colors hover:text-primary-300"
                  >
                    View all notifications
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-white dark:bg-white/5"
              aria-label="Open user menu"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-sm font-medium text-white">
                {user?.name?.[0] || 'U'}
              </div>
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-[#0a0a0a] shadow-xl"
                >
                  <div className="border-b border-neutral-200 dark:border-white/[0.06] px-4 py-3">
                    <p className="text-sm font-medium text-neutral-800 dark:text-white/80">{user?.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-white/30">{user?.email}</p>
                  </div>
                  <Link to="/app/settings" onClick={() => setUserMenuOpen(false)} className="block px-4 py-2 text-sm text-neutral-600 dark:text-white/50 transition-colors hover:bg-white dark:hover:bg-white dark:bg-white/5">
                    Settings
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setUserMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 transition-colors hover:bg-white dark:bg-white/5"
                  >
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
