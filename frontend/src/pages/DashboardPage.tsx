import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuthStore, useDriftStore, useEndpointStore, useProjectStore, useSocketStore } from '@/store';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Skeleton } from '@/components/common/Skeleton';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import { LiveIndicator } from '@/components/dashboard/LiveIndicator';
import { StatsCard } from '@/components/dashboard/StatsCard';
import {
  Activity,
  AlertTriangle,
  Plus,
  LineChart,
  FileText,
  Server,
  CheckCircle,
  Clock,
  TrendingUp,
  Play,
  Pause,
  Wifi,
  WifiOff,
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

const demoDriftEvents = [
  {
    id: '1',
    endpointName: '/api/users',
    endpointUrl: 'GET /api/v1/users',
    severity: 'breaking' as const,
    message: 'Field "email" changed from required to optional',
    detectedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: '2',
    endpointName: '/api/products',
    endpointUrl: 'POST /api/v1/products',
    severity: 'medium' as const,
    message: 'New optional field "category" added',
    detectedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: '3',
    endpointName: '/api/orders',
    endpointUrl: 'GET /api/v1/orders/:id',
    severity: 'low' as const,
    message: 'Field "status" enum values updated',
    detectedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: '4',
    endpointName: '/api/auth/login',
    endpointUrl: 'POST /api/v1/auth/login',
    severity: 'breaking' as const,
    message: 'Response schema changed significantly',
    detectedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: '5',
    endpointName: '/api/webhooks',
    endpointUrl: 'PUT /api/v1/webhooks/:id',
    severity: 'low' as const,
    message: 'Description updated for "url" field',
    detectedAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
];

const demoActivityData = [
  { day: 'Mon', changes: 3 },
  { day: 'Tue', changes: 5 },
  { day: 'Wed', changes: 2 },
  { day: 'Thu', changes: 8 },
  { day: 'Fri', changes: 4 },
  { day: 'Sat', changes: 1 },
  { day: 'Sun', changes: 6 },
];

type ActivityBucket = {
  day: string;
  date?: string;
  changes: number;
};

type GraphData = {
  responseTimes?: Array<{ time?: string; value?: number }>;
  events?: Array<{ createdAt?: string; detectedAt?: string; severity?: string; status?: string }>;
  activity?: Array<{ type?: string; label?: string; createdAt?: string }>;
};

type StatTrend = {
  direction: 'up' | 'down';
  value: number;
  positive: boolean;
};

type DashboardDriftEvent = {
  id: string;
  endpointName: string;
  endpointUrl: string;
  severity: 'low' | 'medium' | 'breaking';
  message: string;
  detectedAt: string;
};

const monitoringDurations = [
  { label: 'All time', value: 'all' },
  { label: '15 min', value: '15m' },
  { label: '1 hour', value: '1h' },
  { label: '6 hours', value: '6h' },
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
];

const RESTART_COOLDOWN_MS = 10000;

function buildLastSevenDaysActivity(timestamps: string[]): ActivityBucket[] {
  const today = new Date();
  const buckets = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - (6 - index));

    return {
      key: date.toISOString().slice(0, 10),
      day: date.toLocaleDateString(undefined, { weekday: 'short' }),
      date: date.toISOString().slice(0, 10),
      changes: 0,
    };
  });

  timestamps.forEach((timestamp) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return;
    const key = date.toISOString().slice(0, 10);
    const bucket = buckets.find((item) => item.key === key);
    if (bucket) bucket.changes += 1;
  });

  return buckets.map(({ day, date, changes }) => ({ day, date, changes }));
}

function countBetween(timestamps: string[], start: number, end: number) {
  return timestamps.filter((timestamp) => {
    const time = new Date(timestamp).getTime();
    return !Number.isNaN(time) && time >= start && time < end;
  }).length;
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function endpointPercent(count: number, total: number) {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

function dashboardSeverity(severity: string): DashboardDriftEvent['severity'] {
  if (severity === 'critical' || severity === 'high' || severity === 'breaking') return 'breaking';
  if (severity === 'medium') return 'medium';
  return 'low';
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return `${Math.floor(diffInMinutes / 1440)}d ago`;
}

export default function DashboardPage() {
  const graphSectionRef = useRef<HTMLDivElement>(null);
  const monitoringActionRef = useRef(0);
  const restartCooldownTargetRef = useRef<number | null>(null);
  const initialLoadDone = useRef(false);
  const { user } = useAuthStore();
  const { currentProject, fetchProject, resumeMonitoring, startMonitoring, stopMonitoring } = useProjectStore();
  const { driftEvents, isLoading: driftLoading, fetchDriftEvents } = useDriftStore();
  const { endpoints, isLoading: endpointsLoading, fetchEndpoints } = useEndpointStore();
  const socketStatus = useSocketStore((state) => state.status);
  const joinProjectRoom = useSocketStore((state) => state.joinProjectRoom);
  const leaveProjectRoom = useSocketStore((state) => state.leaveProjectRoom);

  const [reportOpen, setReportOpen] = useState(false);
  const [lastReportAt, setLastReportAt] = useState<string | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [activityData, setActivityData] = useState<ActivityBucket[]>(demoActivityData);
  const [activityTimestamps, setActivityTimestamps] = useState<string[]>([]);
  const [monitoringDuration, setMonitoringDuration] = useState('all');
  const [isUpdatingMonitoring, setIsUpdatingMonitoring] = useState(false);
  const [restartSecondsRemaining, setRestartSecondsRemaining] = useState(0);
  const reportUrlRef = useRef<string | null>(null);
  const reportFileName = 'driftboard-demo-report.json';

  const isSocketConnected = socketStatus === 'connected';

  // Join project room for real-time updates
  useEffect(() => {
    if (currentProject?.id && isSocketConnected) {
      joinProjectRoom(currentProject.id);
    }
    return () => {
      if (currentProject?.id) {
        leaveProjectRoom();
      }
    };
  }, [currentProject?.id, isSocketConnected, joinProjectRoom, leaveProjectRoom]);

  // Initial data fetch
  useEffect(() => {
    if (currentProject?.id && !initialLoadDone.current) {
      initialLoadDone.current = true;
      void fetchEndpoints(currentProject.id);
      void fetchDriftEvents(currentProject.id);
    }
  }, [currentProject?.id, fetchEndpoints, fetchDriftEvents]);

  // Poll project data - use longer intervals when socket is connected
  useEffect(() => {
    if (!currentProject?.id) return;
    const refreshProject = () => void fetchProject(currentProject.id);
    // Longer polling when socket is connected (socket provides real-time updates)
    const intervalMs = isSocketConnected ? 60000 : 15000;
    const intervalId = window.setInterval(refreshProject, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [currentProject?.id, fetchProject, isSocketConnected]);

  // Poll activity data - reduced frequency when socket is connected
  useEffect(() => {
    if (!currentProject?.id) {
      setActivityData(buildLastSevenDaysActivity([]));
      setActivityTimestamps([]);
      return;
    }

    if (currentProject.id === 'project_demo') {
      setActivityData(demoActivityData);
      setActivityTimestamps([]);
      return;
    }

    let cancelled = false;

    const refreshActivity = async () => {
      try {
        const graphData = await api.get<GraphData>(`/projects/${currentProject.id}/graph-data`);
        if (cancelled) return;

        const graphTimestamps = [
          ...(graphData.responseTimes || []).map((item) => item.time),
          ...(graphData.events || []).map((event) => event.createdAt || event.detectedAt),
          ...(graphData.activity || []).map((event) => event.createdAt),
        ].filter((timestamp): timestamp is string => Boolean(timestamp));

        const endpointTimestamps = endpoints
          .filter((endpoint) => endpoint.projectId === currentProject.id)
          .flatMap((endpoint) => [
            endpoint.createdAt,
            endpoint.updatedAt,
            endpoint.lastCheckedAt,
            endpoint.lastDriftAt,
            ...(endpoint.schemaVersions || []).map((version) => version.createdAt),
          ])
          .filter((timestamp): timestamp is string => Boolean(timestamp));

        const timestamps = [
          currentProject.createdAt,
          currentProject.updatedAt,
          ...graphTimestamps,
          ...endpointTimestamps,
        ].filter((timestamp): timestamp is string => Boolean(timestamp));
        setActivityTimestamps(timestamps);
        setActivityData(buildLastSevenDaysActivity(timestamps));
      } catch {
        if (!cancelled) {
          const endpointTimestamps = endpoints
            .filter((endpoint) => endpoint.projectId === currentProject.id)
            .flatMap((endpoint) => [
              endpoint.createdAt,
              endpoint.updatedAt,
              endpoint.lastCheckedAt,
              endpoint.lastDriftAt,
              ...(endpoint.schemaVersions || []).map((version) => version.createdAt),
            ])
            .filter((timestamp): timestamp is string => Boolean(timestamp));
          const timestamps = [
            currentProject.createdAt,
            currentProject.updatedAt,
            ...endpointTimestamps,
          ].filter((timestamp): timestamp is string => Boolean(timestamp));
          setActivityTimestamps(timestamps);
          setActivityData(buildLastSevenDaysActivity(timestamps));
        }
      }
    };

    void refreshActivity();
    // Longer interval when socket is connected (socket provides real-time updates)
    const intervalMs = isSocketConnected ? 30000 : 5000;
    const intervalId = window.setInterval(refreshActivity, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [currentProject?.id, endpoints, isSocketConnected]);

  const projectEndpoints = currentProject?.id
    ? endpoints.filter((endpoint) => endpoint.projectId === currentProject.id)
    : [];
  const totalEndpoints = projectEndpoints.length;
  const trendNow = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const currentWindowStart = trendNow - sevenDays;
  const projectDriftEvents = currentProject?.id
    ? driftEvents.filter((event) => event.projectId === currentProject.id)
    : [];
  const displayEvents: DashboardDriftEvent[] = currentProject?.id === 'project_demo'
    ? demoDriftEvents
    : projectDriftEvents.map((event) => {
        const endpoint = projectEndpoints.find((item) => item.id === event.endpointId);
        return {
          id: event.id,
          endpointName: event.endpointName || endpoint?.name || 'Endpoint',
          endpointUrl: `${endpoint?.method || 'API'} ${endpoint?.url || event.endpointName || ''}`.trim(),
          severity: dashboardSeverity(event.severity),
          message: event.message || `${event.endpointName || endpoint?.name || 'Endpoint'} changed`,
          detectedAt: event.detectedAt,
        };
      });
  const activeDriftEvents = projectDriftEvents.filter((event) => !event.resolvedAt);
  const activeDriftEndpointIds = new Set(activeDriftEvents.map((event) => event.endpointId));
  const driftedEndpointCount = projectEndpoints.filter(
    (endpoint) => endpoint.status === 'drifted' || activeDriftEndpointIds.has(endpoint.id)
  ).length;
  const monitoredEndpointCount = projectEndpoints.filter((endpoint) => endpoint.monitoringEnabled !== false && endpoint.status !== 'disabled').length;
  const degradedEndpointCount = projectEndpoints.filter((endpoint) => ['warning', 'drifted', 'failed', 'disabled'].includes(endpoint.status || '')).length;
  const recentChangeEndpointIds = new Set(
    projectEndpoints
      .filter((endpoint) => {
        const timestamps = [
          endpoint.updatedAt,
          endpoint.lastCheckedAt,
          endpoint.lastDriftAt,
          ...(endpoint.schemaVersions || []).map((version) => version.createdAt),
        ];
        return timestamps.some((timestamp) => {
          const time = new Date(timestamp || '').getTime();
          return !Number.isNaN(time) && time >= currentWindowStart && time < trendNow;
        });
      })
      .map((endpoint) => endpoint.id)
  );
  const averageHealth = totalEndpoints === 0
    ? 100
    : Math.round(
        projectEndpoints.reduce((total, endpoint) => total + Math.max(0, Math.min(100, Number(endpoint.health ?? 100))), 0) / totalEndpoints
      );
  const stats = {
    totalEndpoints,
    activeDrifts: currentProject?.id === 'project_demo'
      ? demoDriftEvents.filter((event) => event.severity === 'breaking' || event.severity === 'medium').length
      : Math.max(activeDriftEvents.length, driftedEndpointCount),
    recentChanges: currentProject?.id === 'project_demo' ? demoDriftEvents.length : recentChangeEndpointIds.size,
    apiHealth: currentProject?.id === 'project_demo' ? 91 : averageHealth,
  };
  const previousWindowStart = trendNow - sevenDays * 2;
  const driftTimestamps = displayEvents.map((event) => event.detectedAt);
  const previousChanges = countBetween(activityTimestamps.length > 0 ? activityTimestamps : driftTimestamps, previousWindowStart, currentWindowStart);
  const statTrends = currentProject?.id === 'project_demo'
    ? {
        totalEndpoints: { direction: 'up' as const, value: 2, positive: true },
        activeDrifts: { direction: 'down' as const, value: 1, positive: true },
        recentChanges: { direction: 'up' as const, value: 5, positive: true },
        apiHealth: { direction: 'up' as const, value: 2, positive: true },
      }
    : {
        totalEndpoints: {
          direction: monitoredEndpointCount >= totalEndpoints ? 'up' as const : 'down' as const,
          value: endpointPercent(monitoredEndpointCount, totalEndpoints),
          positive: totalEndpoints === 0 || monitoredEndpointCount === totalEndpoints,
        },
        activeDrifts: {
          direction: driftedEndpointCount > 0 ? 'up' as const : 'down' as const,
          value: endpointPercent(driftedEndpointCount, totalEndpoints),
          positive: driftedEndpointCount === 0,
        },
        recentChanges: {
          direction: recentChangeEndpointIds.size >= previousChanges ? 'up' as const : 'down' as const,
          value: endpointPercent(recentChangeEndpointIds.size, totalEndpoints),
          positive: true,
        },
        apiHealth: {
          direction: degradedEndpointCount > 0 ? 'down' as const : 'up' as const,
          value: endpointPercent(degradedEndpointCount, totalEndpoints),
          positive: degradedEndpointCount === 0,
        },
      };
  const isProjectConnected = Boolean(
    currentProject?.id && ['active', 'connected', 'monitoring'].includes(currentProject.monitoringStatus || '')
  );
  const isRestartCoolingDown = !isProjectConnected && restartSecondsRemaining > 0;
  const selectedDurationLabel = monitoringDurations.find((item) => item.value === monitoringDuration)?.label || 'All time';
  const monitoringEndsAt = currentProject?.monitoringEndsAt ? new Date(currentProject.monitoringEndsAt) : null;
  const canRunScans = hasProjectPermission(currentProject?.currentUserRole, 'scan:run');
  const canAddEndpoint = hasProjectPermission(currentProject?.currentUserRole, 'endpoint:create');
  const monitoringStatusText = !currentProject?.id
    ? 'No project connected'
    : isProjectConnected
    ? monitoringEndsAt
      ? `Monitoring until ${monitoringEndsAt.toLocaleString()}`
      : 'Continuous monitoring is active'
    : isRestartCoolingDown
    ? `You can restart monitoring in ${restartSecondsRemaining}s.`
    : 'Disconnected. Ready to resume when you are.';

  const maxChanges = Math.max(1, ...activityData.map((d) => d.changes));
  const totalActivity = activityData.reduce((total, item) => total + item.changes, 0);
  const todayKey = new Date().toISOString().slice(0, 10);

  const viewGraph = useCallback(() => {
    graphSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const generateReport = useCallback(() => {
    const generatedAt = new Date().toISOString();
    const report = {
      generatedAt,
      project: currentProject,
      stats,
      driftEvents: displayEvents,
      activity: activityData,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    if (reportUrlRef.current) {
      URL.revokeObjectURL(reportUrlRef.current);
    }
    const url = URL.createObjectURL(blob);
    reportUrlRef.current = url;
    setReportUrl(url);
    const link = document.createElement('a');
    link.href = url;
    link.download = reportFileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setLastReportAt(generatedAt);
    setReportOpen(true);
  }, [currentProject, stats, displayEvents, activityData]);

  const startProjectMonitoring = useCallback(async () => {
    if (!currentProject?.id) return;
    if (!canRunScans) return;
    if (isUpdatingMonitoring) return;
    if (!isProjectConnected && isRestartCoolingDown) return;
    const projectId = currentProject.id;
    const actionId = monitoringActionRef.current + 1;
    monitoringActionRef.current = actionId;
    restartCooldownTargetRef.current = null;
    setRestartSecondsRemaining(0);
    setIsUpdatingMonitoring(true);

    const request = isProjectConnected
      ? startMonitoring(projectId, monitoringDuration)
      : resumeMonitoring(projectId, monitoringDuration);

    window.setTimeout(() => {
      if (monitoringActionRef.current === actionId) {
        setIsUpdatingMonitoring(false);
      }
    }, 180);

    request
      .then(() => {
        void fetchEndpoints(projectId);
        void fetchDriftEvents(projectId);
      })
      .catch(() => {
        if (monitoringActionRef.current === actionId) {
          setIsUpdatingMonitoring(false);
        }
      });
  }, [currentProject?.id, canRunScans, isUpdatingMonitoring, isProjectConnected, isRestartCoolingDown, monitoringDuration, startMonitoring, resumeMonitoring, fetchEndpoints, fetchDriftEvents]);

  const stopProjectMonitoring = useCallback(async () => {
    if (!currentProject?.id) return;
    if (!canRunScans) return;
    if (isUpdatingMonitoring) return;
    const projectId = currentProject.id;
    const actionId = monitoringActionRef.current + 1;
    monitoringActionRef.current = actionId;
    restartCooldownTargetRef.current = Date.now() + RESTART_COOLDOWN_MS;
    setRestartSecondsRemaining(Math.ceil(RESTART_COOLDOWN_MS / 1000));
    setIsUpdatingMonitoring(true);

    stopMonitoring(projectId)
      .then(() => {
        void fetchEndpoints(projectId);
      })
      .catch(() => {
        restartCooldownTargetRef.current = null;
        setRestartSecondsRemaining(0);
        if (monitoringActionRef.current === actionId) {
          setIsUpdatingMonitoring(false);
        }
      });
  }, [currentProject?.id, canRunScans, isUpdatingMonitoring, stopMonitoring, fetchEndpoints]);

  useEffect(() => {
    if (!restartCooldownTargetRef.current) return;
    const intervalId = window.setInterval(() => {
      const target = restartCooldownTargetRef.current;
      if (!target) {
        window.clearInterval(intervalId);
        return;
      }
      const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setRestartSecondsRemaining(remaining);
      if (remaining <= 0) {
        restartCooldownTargetRef.current = null;
        setIsUpdatingMonitoring(false);
        window.clearInterval(intervalId);
      }
    }, 200);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    return () => {
      if (reportUrlRef.current) {
        URL.revokeObjectURL(reportUrlRef.current);
      }
    };
  }, []);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Welcome back, {user?.name?.split(' ')[0] || 'User'}
            </h1>
            <div className="flex items-center gap-2">
              <LiveIndicator isConnected={isProjectConnected} />
              {isSocketConnected && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary-400/20 bg-primary-500/10 px-2.5 py-1 text-[10px] font-medium text-primary-300">
                  <Wifi className="h-3 w-3" />
                  Live
                </span>
              )}
              {!isSocketConnected && socketStatus !== 'disconnected' && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-300">
                  <WifiOff className="h-3 w-3" />
                  Polling
                </span>
              )}
            </div>
          </div>
          <p className="text-neutral-500 dark:text-white/60">
            {currentProject?.name
              ? `${currentProject.name}: ${monitoringStatusText}`
              : 'Connect a project to start monitoring endpoint drift.'}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row xl:flex-wrap xl:items-center xl:justify-end">
          <div className="dashboard-monitoring-controls flex w-full flex-col gap-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 p-2 xl:w-auto xl:flex-row xl:items-center">
            <div className="grid w-full grid-cols-2 overflow-hidden rounded-md border border-neutral-200 dark:border-white/10 sm:grid-cols-3 xl:flex xl:w-auto xl:flex-none">
              {monitoringDurations.map((duration) => (
                <button
                  key={duration.value}
                  type="button"
                  onClick={() => setMonitoringDuration(duration.value)}
                  className={`h-9 min-w-0 px-3 text-xs font-medium transition-colors xl:h-8 xl:min-w-[76px] ${
                    monitoringDuration === duration.value
                      ? 'bg-primary-500/30 text-white'
                      : 'text-neutral-500 dark:text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {duration.label}
                </button>
              ))}
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_86px] xl:w-auto xl:grid-cols-[minmax(174px,auto)_86px]">
              <Button
                size="sm"
                className="w-full whitespace-nowrap xl:min-w-[174px]"
                leftIcon={<Play className="h-4 w-4" />}
                loading={isUpdatingMonitoring}
                disabled={!currentProject?.id || !canRunScans || isUpdatingMonitoring || isRestartCoolingDown}
                onClick={() => void startProjectMonitoring()}
              >
                {isProjectConnected
                  ? `Restart ${selectedDurationLabel}`
                  : isRestartCoolingDown
                  ? `Resume in ${restartSecondsRemaining}s`
                  : 'Resume Monitoring'}
              </Button>
              {isProjectConnected ? (
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                className="whitespace-nowrap"
                leftIcon={<Pause className="h-4 w-4" />}
                loading={isUpdatingMonitoring}
                disabled={!canRunScans || isUpdatingMonitoring}
                onClick={() => void stopProjectMonitoring()}
              >
                Stop
              </Button>
              ) : (
                <span className="hidden h-8 sm:block" aria-hidden="true" />
              )}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full xl:w-auto"
            leftIcon={<LineChart className="w-4 h-4" />}
            onClick={viewGraph}
          >
            View Graph
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="w-full xl:w-auto"
            leftIcon={<FileText className="w-4 h-4" />}
            onClick={generateReport}
          >
            Report
          </Button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {currentProject?.id && !isProjectConnected && (
          <div className="dashboard-alert-danger md:col-span-2 lg:col-span-4 rounded-lg border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{isRestartCoolingDown ? 'Restart cooling down' : 'Ready to resume'}</p>
                <p className="mt-1 text-sm">
                  {isRestartCoolingDown
                    ? `You can restart monitoring in ${restartSecondsRemaining} second${restartSecondsRemaining === 1 ? '' : 's'}.`
                    : 'Your saved project data is still here. Resume monitoring when you want endpoint checks to run again.'}
                </p>
              </div>
              <Button size="sm" className="min-w-[132px]" leftIcon={<Play className="h-4 w-4" />} loading={isUpdatingMonitoring} disabled={!canRunScans || isUpdatingMonitoring || isRestartCoolingDown} onClick={() => void startProjectMonitoring()}>
                {isRestartCoolingDown ? `Resume in ${restartSecondsRemaining}s` : 'Resume Monitoring'}
              </Button>
            </div>
          </div>
        )}
        <StatsCard
          title="Total Endpoints"
          value={stats.totalEndpoints}
          icon={Server}
          trend={statTrends.totalEndpoints}
          loading={endpointsLoading}
        />
        <StatsCard
          title="Active Drifts"
          value={stats.activeDrifts}
          icon={AlertTriangle}
          trend={statTrends.activeDrifts}
          severity="warning"
          loading={driftLoading}
        />
        <StatsCard
          title="Recent Changes"
          value={stats.recentChanges}
          icon={Activity}
          trend={statTrends.recentChanges}
          loading={driftLoading}
        />
        <StatsCard
          title="API Health"
          value={`${stats.apiHealth}%`}
          icon={CheckCircle}
          trend={statTrends.apiHealth}
          severity="success"
          loading={endpointsLoading}
        />
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>Drift Events</CardTitle>
                  {isSocketConnected && (
                    <motion.span
                      className="flex h-2 w-2"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
                    </motion.span>
                  )}
                </div>
                <Link to="/app/drift-events">
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {displayEvents.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 dark:text-white/40">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No drift events detected</p>
                </div>
              ) : (
                displayEvents.slice(0, 5).map((event) => (
                  <motion.div
                    key={event.id}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                    className="flex items-center justify-between p-3 rounded-lg -mx-2 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          event.severity === 'breaking'
                            ? 'bg-red-500'
                            : event.severity === 'medium'
                            ? 'bg-yellow-500'
                            : 'bg-primary-500'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium text-white">{event.endpointUrl}</p>
                        <p className="text-xs text-neutral-500 dark:text-white/50">{event.message}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge severity={event.severity as 'low' | 'medium' | 'breaking'}>
                        {event.severity}
                      </Badge>
                      <span className="text-xs text-neutral-500 dark:text-white/40 whitespace-nowrap">
                        {formatRelativeTime(event.detectedAt)}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} ref={graphSectionRef}>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Activity</CardTitle>
                <span className="text-xs text-neutral-500 dark:text-white/40">
                  Last 7 days
                  {isSocketConnected ? ' - live' : ''}
                </span>
              </div>
              <Badge className="border-primary-400/25 bg-primary-500/15 text-primary-200">
                {totalActivity} event{totalActivity === 1 ? '' : 's'}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="relative h-40 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-black/5 dark:bg-black/10 px-3 pb-3 pt-8">
                <div className="absolute inset-x-3 top-1/2 h-px bg-white/10" />
                <div className="absolute inset-x-3 top-8 h-px bg-white dark:bg-white/5" />
                <div className="grid h-full grid-cols-7 items-end gap-2">
                  {activityData.map((data, index) => {
                    const active = data.changes > 0;
                    const isToday = data.date === todayKey;
                    const barHeight = active ? Math.max(18, (data.changes / maxChanges) * 100) : 6;

                    return (
                      <div key={data.date || data.day} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                        <motion.div
                          initial={{ height: 0, opacity: 0.45 }}
                          animate={{ height: `${barHeight}%`, opacity: active ? 1 : 0.35 }}
                          transition={{ delay: index * 0.08, duration: 0.55, ease: 'easeOut' }}
                          className={`w-full max-w-[28px] rounded-t-md ${
                            active
                              ? 'bg-gradient-to-t from-primary-600 to-primary-400 shadow-lg shadow-primary-500/20'
                              : 'bg-white/10'
                          }`}
                          title={`${data.day}: ${data.changes} activity event${data.changes === 1 ? '' : 's'}`}
                        />                         <span className={`text-[11px] font-medium ${isToday ? 'text-primary-200' : 'text-neutral-500 dark:text-white/40'}`}>
                          {data.changes}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-2">
                {activityData.map((data) => (
                  <span key={data.date || data.day} className={`min-w-0 text-center text-xs ${data.date === todayKey ? 'font-semibold text-primary-200' : 'text-neutral-500 dark:text-white/40'}`}>
                    {data.day}
                  </span>
                ))}
              </div>
              {totalActivity === 0 && (
                <p className="mt-3 text-xs text-white/45">No tracked activity in the last 7 days yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {canAddEndpoint && (
                <Link to="/app/endpoints" className="block">
                  <Button variant="secondary" fullWidth leftIcon={<Plus className="w-4 h-4" />}>
                    Add Endpoint
                  </Button>
                </Link>
              )}
              <Link to="/app/schema-history" className="block">
                <Button variant="secondary" fullWidth leftIcon={<Clock className="w-4 h-4" />}>
                  View History
                </Button>
              </Link>
              <Button variant="secondary" fullWidth leftIcon={<TrendingUp className="w-4 h-4" />} onClick={generateReport}>
                Generate Report
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Modal isOpen={reportOpen} onClose={() => setReportOpen(false)} size="lg">
        <ModalHeader>
          <h2 className="text-xl font-semibold text-white">Report generated</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-white/60">
            {lastReportAt ? `Created ${new Date(lastReportAt).toLocaleString()}` : 'Your dashboard report is ready.'}
          </p>
        </ModalHeader>
        <ModalBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 p-4">
              <p className="text-xs text-neutral-500 dark:text-white/50">Endpoints</p>
              <p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">{stats.totalEndpoints}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 p-4">
              <p className="text-xs text-neutral-500 dark:text-white/50">Active drifts</p>
              <p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">{stats.activeDrifts}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 p-4">
              <p className="text-xs text-neutral-500 dark:text-white/50">Recent changes</p>
              <p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">{stats.recentChanges}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 p-4">
              <p className="text-xs text-neutral-500 dark:text-white/50">API health</p>
              <p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">{stats.apiHealth}%</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-neutral-500 dark:text-white/60">
            A JSON copy was generated for download, and this summary confirms the action completed.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setReportOpen(false)}>
            Close
          </Button>
          {reportUrl ? (
            <a
              href={reportUrl}
              download={reportFileName}
              className="primary-action-link inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200"
            >
              <FileText className="h-4 w-4" />
              Download report
            </a>
          ) : (
            <Button onClick={generateReport} leftIcon={<FileText className="w-4 h-4" />}>
              Download report
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </motion.div>
  );
}
