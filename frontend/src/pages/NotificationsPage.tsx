import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore, useProjectStore, type NotificationType } from '@/store';
import { Card, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Skeleton } from '@/components/common/Skeleton';
import { Badge } from '@/components/common/Badge';
import {
  Bell,
  AlertTriangle,
  GitBranch,
  Users,
  CheckCheck,
  Clock,
  Trash2,
  ChevronDown,
  Square,
  CheckSquare,
  KeyRound,
} from 'lucide-react';
import { hasProjectPermission } from '@/utils/permissions';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

const typeIcons = {
  drift: AlertTriangle,
  schema: GitBranch,
  system: KeyRound,
  member: Users,
  team: Users,
};

const typeColors = {
  drift: 'bg-red-500/20 text-red-400 border-red-500/30',
  schema: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
  system: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
  member: 'bg-green-500/20 text-green-400 border-green-500/30',
  team: 'bg-green-500/20 text-green-400 border-green-500/30',
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return `${Math.floor(diffInMinutes / 1440)}d ago`;
}

const filterOptions: { value: NotificationType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'drift', label: 'Drift' },
  { value: 'schema', label: 'Schema' },
  { value: 'system', label: 'API keys' },
];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, isLoading, isMarkingRead, fetchNotifications, markAsRead, markAllAsRead, deleteNotifications, deleteHistory } = useNotificationStore();
  const { currentProject } = useProjectStore();
  const [activeFilter, setActiveFilter] = useState<NotificationType | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const cleanupRef = useRef<HTMLDivElement>(null);
  const notificationsPerPage = 10;
  const canCleanHistory = hasProjectPermission(currentProject?.currentUserRole, 'notification:update');

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const closeCleanupMenu = (event: PointerEvent) => {
      if (cleanupOpen && cleanupRef.current && !cleanupRef.current.contains(event.target as Node)) {
        setCleanupOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeCleanupMenu);
    return () => document.removeEventListener('pointerdown', closeCleanupMenu);
  }, [cleanupOpen]);

  const displayNotifications = notifications as AppNotification[];
  const unreadCount = displayNotifications.filter((n) => !n.read).length;

  const filteredNotifications = activeFilter === 'all'
    ? displayNotifications
    : displayNotifications.filter((n) => n.type === activeFilter);

  const totalPages = Math.ceil(filteredNotifications.length / notificationsPerPage);
  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * notificationsPerPage,
    currentPage * notificationsPerPage
  );

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
  };

  const notificationTarget = (notification: AppNotification) => {
    if (notification.actionUrl) return notification.actionUrl;
    if (notification.type === 'drift') return '/app/drift-events';
    if (notification.type === 'schema') return '/app/schema-history';
    if (notification.type === 'system' && notification.title.toLowerCase().startsWith('api key')) return '/app/api-keys';
    if (notification.type === 'team' || notification.type === 'member') return '/app/settings';
    return '/app/notifications';
  };

  const openNotification = async (notification: AppNotification) => {
    if (!notification.read) await markAsRead(notification.id);
    navigate(notificationTarget(notification));
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const pageIds = paginatedNotifications.map((notification) => notification.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const togglePageSelected = () => {
    setSelectedIds((current) => {
      if (allPageSelected) return current.filter((id) => !pageIds.includes(id));
      return [...new Set([...current, ...pageIds])];
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected notification${selectedIds.length === 1 ? '' : 's'}?`)) return;
    try {
      const deleted = await deleteNotifications(selectedIds);
      setSelectedIds([]);
      await fetchNotifications();
      toast.success(`${deleted} notification${deleted === 1 ? '' : 's'} deleted.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete selected notifications.');
    }
  };

  const handleDeleteHistory = async (hours: 24 | 168 | 720, label: string) => {
    if (!canCleanHistory) return;
    if (!window.confirm(`Delete notification history older than ${label}?`)) return;
    try {
      const deleted = await deleteHistory(hours);
      setSelectedIds([]);
      setCleanupOpen(false);
      toast.success(`${deleted} old notification${deleted === 1 ? '' : 's'} deleted.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not clean notification history.');
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants} className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Notifications</h1>
          <p className="text-neutral-500 dark:text-white/60">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
        {selectedIds.length > 0 && (
          <Button
            variant="danger"
            leftIcon={<Trash2 className="w-4 h-4" />}
            onClick={() => void handleDeleteSelected()}
          >
            Delete selected ({selectedIds.length})
          </Button>
        )}
        {canCleanHistory && (
        <div className="relative" ref={cleanupRef}>
          <Button
            variant="secondary"
            leftIcon={<Trash2 className="w-4 h-4" />}
            rightIcon={<ChevronDown className="w-4 h-4" />}
            onClick={() => setCleanupOpen((open) => !open)}
          >
            Clean history
          </Button>
          {cleanupOpen && (
            <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-white/10 bg-black shadow-xl">
              {[
                { label: 'Older than 24 hours', hours: 24 as const },
                { label: 'Older than 7 days', hours: 168 as const },
                { label: 'Older than 30 days', hours: 720 as const },
              ].map((item) => (
                <button
                  key={item.hours}
                  onClick={() => void handleDeleteHistory(item.hours, item.label.replace('Older than ', ''))}
                  className="block w-full px-4 py-3 text-left text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        )}
        {unreadCount > 0 && (
          <Button
            variant="secondary"
            leftIcon={<CheckCheck className="w-4 h-4" />}
            onClick={handleMarkAllAsRead}
            loading={isMarkingRead}
          >
            Mark all as read
          </Button>
        )}
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto">
            {filterOptions.map((filter) => (
              <button
                key={filter.value}
                onClick={() => {
                  setActiveFilter(filter.value);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeFilter === filter.value
                    ? 'bg-white/10 text-white'
                    : 'text-neutral-500 dark:text-white/50 hover:text-white hover:bg-white dark:bg-white/5'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {paginatedNotifications.length > 0 && (
            <button
              onClick={togglePageSelected}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/65 transition-colors hover:bg-white dark:bg-white/5 hover:text-white"
            >
              {allPageSelected ? <CheckSquare className="h-4 w-4 text-primary-300" /> : <Square className="h-4 w-4" />}
              {allPageSelected ? 'Clear page selection' : 'Select visible'}
            </button>
          )}
          </div>
        </Card>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="card" height={80} />
          ))}
        </div>
      ) : paginatedNotifications.length === 0 ? (
        <motion.div variants={itemVariants} className="text-center py-16">
          <div className="w-16 h-16 bg-white dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-neutral-400 dark:text-white/30" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No notifications</h3>
          <p className="text-neutral-500 dark:text-white/50">
            {activeFilter !== 'all' ? 'No notifications match your filter.' : 'You have no notifications yet.'}
          </p>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="space-y-3">
          {paginatedNotifications.map((notification) => {
            const IconComponent = typeIcons[notification.type];
            return (
              <motion.div key={notification.id} variants={itemVariants}>
                <Card
                  className={`cursor-pointer transition-all ${
                    !notification.read ? 'bg-white/10 border-white/20' : ''
                  }`}
                  onClick={() => void openNotification(notification)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleSelected(notification.id);
                        }}
                        className="mt-2 rounded-md p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                        aria-label={selectedIds.includes(notification.id) ? 'Deselect notification' : 'Select notification'}
                      >
                        {selectedIds.includes(notification.id) ? <CheckSquare className="h-5 w-5 text-primary-300" /> : <Square className="h-5 w-5" />}
                      </button>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${typeColors[notification.type]}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-white font-medium">{notification.title}</p>
                            <p className="text-sm text-neutral-600 dark:text-white/70 mt-0.5">{notification.message}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {!notification.read && (
                              <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                            )}
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                void (async () => {
                                  try {
                                    const deleted = await deleteNotifications([notification.id]);
                                    setSelectedIds((current) => current.filter((id) => id !== notification.id));
                                    await fetchNotifications();
                                    toast.success(`${deleted || 1} notification deleted.`);
                                  } catch (error) {
                                    toast.error(error instanceof Error ? error.message : 'Could not delete notification.');
                                  }
                                })();
                              }}
                              className="rounded-md p-1.5 text-neutral-500 dark:text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-300"
                              aria-label="Delete notification"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-neutral-500 dark:text-white/40 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatRelativeTime(notification.createdAt)}
                          </span>
                          <Badge
                            className={typeColors[notification.type]}
                          >
                            {notification.type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {totalPages > 1 && (
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <p className="text-sm text-neutral-500 dark:text-white/50">
            Showing {(currentPage - 1) * notificationsPerPage + 1} to {Math.min(currentPage * notificationsPerPage, filteredNotifications.length)} of {filteredNotifications.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Previous
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
