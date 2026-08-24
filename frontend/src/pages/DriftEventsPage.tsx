import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDriftStore, useEndpointStore, useProjectStore } from '@/store';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Badge } from '@/components/common/Badge';
import { Skeleton } from '@/components/common/Skeleton';
import { Dropdown, DropdownTrigger, type DropdownItem } from '@/components/common/Dropdown';
import {
  AlertTriangle,
  Search,
  Filter,
  Calendar,
  ChevronDown,
  ChevronRight,
  Check,
  CheckCheck,
  RefreshCw,
  X,
  Copy,
  Code2,
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

type Severity = 'all' | 'breaking' | 'medium' | 'low';
type StatusFilter = 'all' | 'open' | 'acknowledged' | 'resolved';

interface DriftEvent {
  id: string;
  endpointName: string;
  endpointUrl: string;
  method: string;
  severity: 'breaking' | 'medium' | 'low';
  message: string;
  changes: Array<{
    path: string;
    field: string;
    expected: unknown;
    actual: unknown;
    type: 'added' | 'removed' | 'modified';
  }>;
  detectedAt: string;
  acknowledged: boolean;
  resolved: boolean;
}

type BackendDriftEvent = {
  id: string;
  endpointId: string;
  endpointName: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'breaking';
  status?: 'new' | 'acknowledged' | 'resolved' | 'ignored';
  detectedAt?: string;
  createdAt?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  message?: string;
  title?: string;
  description?: string;
  changes?: Array<{
    path?: string;
    field?: string;
    expected?: unknown;
    actual?: unknown;
    type?: 'added' | 'removed' | 'modified';
  }>;
};

const mockDriftEvents: DriftEvent[] = [
  {
    id: '1',
    endpointName: 'Get Users',
    endpointUrl: '/api/v1/users',
    method: 'GET',
    severity: 'breaking',
    message: 'Field "email" changed from required to optional',
    changes: [
      { path: 'properties.email', field: 'email', expected: 'required', actual: 'optional', type: 'modified' },
      { path: 'properties.email.type', field: 'type', expected: 'string', actual: 'string', type: 'modified' },
    ],
    detectedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    acknowledged: false,
    resolved: false,
  },
  {
    id: '2',
    endpointName: 'Create Product',
    endpointUrl: '/api/v1/products',
    method: 'POST',
    severity: 'medium',
    message: 'New optional field "category" added',
    changes: [
      { path: 'properties.category', field: 'category', expected: 'undefined', actual: 'string', type: 'added' },
    ],
    detectedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    acknowledged: true,
    resolved: false,
  },
  {
    id: '3',
    endpointName: 'Update Order',
    endpointUrl: '/api/v1/orders/:id',
    method: 'PUT',
    severity: 'low',
    message: 'Field "status" enum values updated',
    changes: [
      { path: 'properties.status.enum', field: 'status', expected: '["pending","completed"]', actual: '["pending","processing","completed"]', type: 'modified' },
    ],
    detectedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    acknowledged: false,
    resolved: false,
  },
  {
    id: '4',
    endpointName: 'Login',
    endpointUrl: '/api/v1/auth/login',
    method: 'POST',
    severity: 'breaking',
    message: 'Response schema changed significantly',
    changes: [
      { path: 'properties.token', field: 'token', expected: 'string', actual: 'undefined', type: 'removed' },
      { path: 'properties.access_token', field: 'access_token', expected: 'undefined', actual: 'string', type: 'added' },
    ],
    detectedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    acknowledged: true,
    resolved: true,
  },
  {
    id: '5',
    endpointName: 'Update Webhook',
    endpointUrl: '/api/v1/webhooks/:id',
    method: 'PATCH',
    severity: 'low',
    message: 'Description updated for "url" field',
    changes: [
      { path: 'properties.url.description', field: 'description', expected: 'Webhook URL', actual: 'Destination URL for webhook', type: 'modified' },
    ],
    detectedAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    acknowledged: false,
    resolved: false,
  },
];

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function severityFromBackend(severity: BackendDriftEvent['severity']): DriftEvent['severity'] {
  if (severity === 'critical' || severity === 'high' || severity === 'breaking') return 'breaking';
  return severity;
}

function formatChangeValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'missing';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getChangeType(expected: unknown, actual: unknown): DriftEvent['changes'][number]['type'] {
  if (expected === undefined || expected === null) return 'added';
  if (actual === undefined || actual === null) return 'removed';
  return 'modified';
}

function flattenSchema(schema: Record<string, unknown>, prefix = 'response') {
  const fields = new Map<string, unknown>();

  Object.entries(schema || {}).forEach(([key, value]) => {
    const path = `${prefix}.${key}`;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = flattenSchema(value as Record<string, unknown>, path);
      nested.forEach((nestedValue, nestedPath) => fields.set(nestedPath, nestedValue));
      if (nested.size === 0) fields.set(path, 'object');
      return;
    }
    fields.set(path, value);
  });

  return fields;
}

function compareSchemas(previous: Record<string, unknown>, latest: Record<string, unknown>): DriftEvent['changes'] {
  const previousFields = flattenSchema(previous);
  const latestFields = flattenSchema(latest);
  const paths = new Set([...previousFields.keys(), ...latestFields.keys()]);
  const changes: DriftEvent['changes'] = [];

  paths.forEach((path) => {
    const expected = previousFields.get(path);
    const actual = latestFields.get(path);
    if (formatChangeValue(expected) === formatChangeValue(actual)) return;
    changes.push({
      path,
      field: path.split('.').pop() || path,
      expected,
      actual,
      type: getChangeType(expected, actual),
    });
  });

  return changes;
}

function changeSummary(change: DriftEvent['changes'][number]) {
  const path = change.path || change.field;
  if (change.type === 'added') return `${path} was added as ${formatChangeValue(change.actual)}`;
  if (change.type === 'removed') return `${path} was removed; it was ${formatChangeValue(change.expected)}`;
  return `${path} changed from ${formatChangeValue(change.expected)} to ${formatChangeValue(change.actual)}`;
}

function fieldLabel(change: DriftEvent['changes'][number]) {
  return change.field || change.path.split('.').pop() || change.path;
}

function changeListSummary(changes: DriftEvent['changes']) {
  const grouped = changes.reduce(
    (acc, change) => {
      acc[change.type].push(fieldLabel(change));
      return acc;
    },
    { added: [] as string[], removed: [] as string[], modified: [] as string[] }
  );

  return [
    grouped.removed.length ? `${grouped.removed.join(', ')} removed` : '',
    grouped.added.length ? `${grouped.added.join(', ')} added` : '',
    grouped.modified.length ? `${grouped.modified.join(', ')} changed` : '',
  ].filter(Boolean).join(', ') || `${changes.length} schema update${changes.length === 1 ? '' : 's'}`;
}

function diffLines(changes: DriftEvent['changes'], side: 'old' | 'new') {
  return changes
    .filter((change) => (side === 'old' ? change.type !== 'added' : change.type !== 'removed'))
    .map((change) => {
      const prefix = side === 'old' ? '-' : '+';
      const value = side === 'old' ? change.expected : change.actual;
      return `${prefix} ${fieldLabel(change)}: ${formatChangeValue(value)}`;
    });
}

function copyText(value: string) {
  void navigator.clipboard?.writeText(value);
}

function openableUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith('/') ? url : `/${url}`;
}

function handleUrlClick(event: React.MouseEvent<HTMLAnchorElement>) {
  if (event.ctrlKey || event.metaKey || event.button === 1) return;
  event.preventDefault();
}

function UrlLink({ url, className }: { url: string; className?: string }) {
  return (
    <a
      href={openableUrl(url)}
      target="_blank"
      rel="noreferrer"
      onClick={handleUrlClick}
      title="Ctrl-click to open in a new tab"
      className={className}
    >
      {url}
    </a>
  );
}

function normalizeBackendEvent(event: BackendDriftEvent, endpointUrl: string, method: string): DriftEvent {
  const changes =
    event.changes?.map((change) => ({
      path: change.path || change.field || 'response',
      field: change.field || change.path?.split('.').pop() || 'response',
      expected: change.expected,
      actual: change.actual,
      type: change.type || getChangeType(change.expected, change.actual),
    })) || [];

  return {
    id: event.id,
    endpointName: event.endpointName,
    endpointUrl,
    method,
    severity: severityFromBackend(event.severity),
    message: event.message || event.title || event.description || `${changes.length} schema change${changes.length === 1 ? '' : 's'} detected`,
    changes,
    detectedAt: event.detectedAt || event.createdAt || new Date().toISOString(),
    acknowledged: Boolean(event.acknowledgedAt || event.status === 'acknowledged' || event.status === 'resolved'),
    resolved: Boolean(event.resolvedAt || event.status === 'resolved'),
  };
}

export default function DriftEventsPage() {
  const { isLoading, isAcknowledging } = useDriftStore();
  const { currentProject } = useProjectStore();
  const canRunScans = hasProjectPermission(currentProject?.currentUserRole, 'scan:run');
  const canUpdateDrifts = hasProjectPermission(currentProject?.currentUserRole, 'drift:update');
  const { endpoints, fetchEndpoints } = useEndpointStore();
  const [events, setEvents] = useState<DriftEvent[]>(mockDriftEvents);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<Severity>('all');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [isRefreshingEvents, setIsRefreshingEvents] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (currentProject?.id) {
      void fetchEndpoints(currentProject.id);
    }
  }, [currentProject?.id, fetchEndpoints]);

  useEffect(() => {
    if (!currentProject?.id || currentProject.id === 'project_demo') {
      setEvents(mockDriftEvents);
      return;
    }

    const projectEndpoints = endpoints.filter((endpoint) => endpoint.projectId === currentProject.id);

    const loadLiveEvents = async () => {
      const endpointById = new Map(projectEndpoints.map((endpoint) => [endpoint.id, endpoint]));
      const liveEvents = await api.get<BackendDriftEvent[]>(`/projects/${currentProject.id}/drift-events`);

      if (liveEvents.length > 0) {
        setEvents(
          liveEvents.map((event) => {
            const endpoint = endpointById.get(event.endpointId);
            return normalizeBackendEvent(event, endpoint?.url || 'Unknown URL', endpoint?.method || 'GET');
          })
        );
        return;
      }

      setEvents(
        projectEndpoints.flatMap((endpoint) => {
          const versions = [...(endpoint.schemaVersions || [])].sort((a, b) => a.version - b.version);
          const latest = versions[versions.length - 1];
          const previous = versions[versions.length - 2];
          const changes = previous && latest
            ? compareSchemas(previous.schema, latest.schema)
            : [
                {
                  path: endpoint.url,
                  field: endpoint.name,
                  expected: 'not monitored',
                  actual: `Version ${endpoint.currentSchemaVersion} baseline captured`,
                  type: 'added' as const,
                },
              ];

          if (changes.length === 0 && !endpoint.lastDriftAt) return [];

          return [
            {
              id: `project-${endpoint.id}-${latest?.id || endpoint.updatedAt}`,
              endpointName: endpoint.name,
              endpointUrl: endpoint.url,
              method: endpoint.method,
              severity: endpoint.lastDriftAt ? 'medium' : 'low',
              message: previous
                ? `${changes.length} schema field update${changes.length === 1 ? '' : 's'} detected for ${endpoint.name}`
                : `${endpoint.name} was added to monitoring with an initial schema baseline`,
              changes,
              detectedAt: endpoint.lastDriftAt || latest?.createdAt || endpoint.lastCheckedAt || endpoint.updatedAt,
              acknowledged: false,
              resolved: false,
            },
          ];
        })
      );
    };

    void loadLiveEvents().catch(() => {
      setEvents([]);
    });
  }, [currentProject?.id, endpoints]);

  const severityTabs = useMemo(
    () =>
      ([
        { value: 'all' as const, label: 'All' },
        { value: 'breaking' as const, label: 'Breaking' },
        { value: 'medium' as const, label: 'Medium' },
        { value: 'low' as const, label: 'Low' },
      ]).map((tab) => ({
        ...tab,
        count: tab.value === 'all' ? events.length : events.filter((event) => event.severity === tab.value).length,
      })),
    [events]
  );

  const filteredEvents = events.filter((event) => {
    if (search && !event.endpointName.toLowerCase().includes(search.toLowerCase()) &&
        !event.message.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (activeTab !== 'all' && event.severity !== activeTab) return false;
    if (severityFilter && event.severity !== severityFilter) return false;
    if (statusFilter === 'open' && (event.acknowledged || event.resolved)) return false;
    if (statusFilter === 'acknowledged' && (!event.acknowledged || event.resolved)) return false;
    if (statusFilter === 'resolved' && !event.resolved) return false;
    if (dateRange) {
      const ageMs = Date.now() - new Date(event.detectedAt).getTime();
      const maxAge =
        dateRange === '24h' ? 24 * 60 * 60 * 1000 :
        dateRange === '7d' ? 7 * 24 * 60 * 60 * 1000 :
        30 * 24 * 60 * 60 * 1000;
      if (ageMs > maxAge) return false;
    }
    return true;
  });

  const toggleEventSelection = (id: string) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEvents(newSelected);
  };

  const acknowledgeSelected = async () => {
    if (!canUpdateDrifts) return;
    const ids = Array.from(selectedEvents);
    if (currentProject?.id) {
      await api.post('/drift-events/bulk-action', { ids, action: 'acknowledged' });
    }
    setEvents((current) =>
      current.map((event) =>
        selectedEvents.has(event.id) ? { ...event, acknowledged: true } : event
      )
    );
    setSelectedEvents(new Set());
  };

  const acknowledgeEvent = async (id: string) => {
    if (!canUpdateDrifts) return;
    if (currentProject?.id) {
      await api.post(`/drift/${id}/acknowledge`);
    }
    setEvents((current) =>
      current.map((event) => (event.id === id ? { ...event, acknowledged: true } : event))
    );
  };

  const resolveEvent = async (id: string) => {
    if (!canUpdateDrifts) return;
    if (currentProject?.id) {
      await api.post(`/drift/${id}/resolve`);
    }
    setEvents((current) =>
      current.map((event) =>
        event.id === id ? { ...event, acknowledged: true, resolved: true } : event
      )
    );
  };

  const refreshEvents = async () => {
    if (isRefreshingEvents) return;
    setActionError('');
    setIsRefreshingEvents(true);
    if (currentProject?.id) {
      try {
        const result = await api.post<{ checked: number; events: BackendDriftEvent[] }>(`/projects/${currentProject.id}/drift-events/refresh`);
        await fetchEndpoints(currentProject.id);
        const refreshedEndpoints = await api.get<typeof endpoints>(`/projects/${currentProject.id}/endpoints`);
        const endpointById = new Map(refreshedEndpoints.map((endpoint) => [endpoint.id, endpoint]));
        setEvents(
          result.events.map((event) => {
            const endpoint = endpointById.get(event.endpointId);
            return normalizeBackendEvent(event, endpoint?.url || 'Unknown URL', endpoint?.method || 'GET');
          })
        );
        setLastRefreshedAt(new Date().toISOString());
        setActiveTab('all');
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'Unable to refresh drift events.');
      } finally {
        setIsRefreshingEvents(false);
      }
      return;
    }
    setLastRefreshedAt(new Date().toISOString());
    setEvents((current) => [
      {
        ...current[0],
        id: `refresh-${Date.now()}`,
        endpointName: 'Health Check',
        endpointUrl: '/api/v1/health',
        method: 'GET',
        severity: 'low',
        message: `Refresh checked ${currentProject?.name || 'Demo Project'} for schema drift`,
        changes: [
          { path: 'properties.status', field: 'status', expected: 'string', actual: 'string', type: 'modified' },
        ],
        detectedAt: new Date().toISOString(),
        acknowledged: false,
        resolved: false,
      },
      ...current,
    ]);
    setActiveTab('all');
    setIsRefreshingEvents(false);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Drift Events</h1>
          <p className="text-neutral-500 dark:text-white/60">
            {currentProject?.name
              ? `Track and manage schema changes for ${currentProject.name}.`
              : 'Track and manage API schema changes.'}
          </p>
          {lastRefreshedAt && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-white/40">Last refreshed {formatRelativeTime(lastRefreshedAt)}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            leftIcon={<RefreshCw className={`w-4 h-4 ${isRefreshingEvents ? 'animate-spin' : ''}`} />}
            loading={isRefreshingEvents}
            disabled={!canRunScans || isRefreshingEvents}
            onClick={() => void refreshEvents()}
          >
            {isRefreshingEvents ? 'Refreshing' : 'Refresh'}
          </Button>
        </div>
      </motion.div>
      {actionError && (
        <Card className="border-amber-400/20 bg-amber-500/10">
          <CardContent className="py-3 text-sm text-amber-100">{actionError}</CardContent>
        </Card>
      )}

      <motion.div variants={itemVariants}>
        <Card className="relative z-30 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="min-w-[220px] flex-1">
              <Input
                placeholder="Search events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                variant="search"
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
              <Dropdown
                align="start"
                trigger={
                  <DropdownTrigger className="min-w-[132px] justify-between">
                    <Filter className="w-4 h-4" />
                    {severityFilter || 'Severity'}
                  </DropdownTrigger>
                }
                items={[
                  { label: 'All Severities', value: '', onClick: () => setSeverityFilter(null) },
                  { label: 'Breaking', value: 'breaking', onClick: () => setSeverityFilter('breaking') },
                  { label: 'Medium', value: 'medium', onClick: () => setSeverityFilter('medium') },
                  { label: 'Low', value: 'low', onClick: () => setSeverityFilter('low') },
                ]}
              />
              <Dropdown
                align="start"
                trigger={
                  <DropdownTrigger className="min-w-[156px] justify-between">
                    Status: {statusFilter === 'all' ? 'All' : statusFilter}
                  </DropdownTrigger>
                }
                items={[
                  { label: 'All Events', value: 'all', onClick: () => setStatusFilter('all') },
                  { label: 'Open', value: 'open', onClick: () => setStatusFilter('open') },
                  { label: 'Acknowledged', value: 'acknowledged', onClick: () => setStatusFilter('acknowledged') },
                  { label: 'Resolved', value: 'resolved', onClick: () => setStatusFilter('resolved') },
                ]}
              />
              <Dropdown
                align="start"
                trigger={
                  <DropdownTrigger className="min-w-[150px] justify-between">
                    <Calendar className="w-4 h-4" />
                    {dateRange || 'Date Range'}
                  </DropdownTrigger>
                }
                items={[
                  { label: 'All Time', value: '', onClick: () => setDateRange(null) },
                  { label: 'Last 24 hours', value: '24h', onClick: () => setDateRange('24h') },
                  { label: 'Last 7 days', value: '7d', onClick: () => setDateRange('7d') },
                  { label: 'Last 30 days', value: '30d', onClick: () => setDateRange('30d') },
                ]}
              />
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-4 border-b border-neutral-200 dark:border-white/10">
          {severityTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`relative py-3 px-1 text-sm font-medium transition-colors ${
                activeTab === tab.value ? 'text-white' : 'text-neutral-500 dark:text-white/50 hover:text-neutral-600 dark:text-white/70'
              }`}
            >
              <span>{tab.label}</span>
              <span className="ml-2 text-xs text-neutral-500 dark:text-white/40">({tab.count})</span>
              {activeTab === tab.value && (
                <motion.div
                  layoutId="severity-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
                />
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {selectedEvents.size > 0 && canUpdateDrifts && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-3 bg-primary-500/10 border border-primary-500/20 rounded-lg"
        >
          <span className="text-sm text-neutral-800 dark:text-white/80">
            {selectedEvents.size} event{selectedEvents.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<CheckCheck className="w-4 h-4" />}
          onClick={() => void acknowledgeSelected()}
              loading={isAcknowledging}
            >
              Acknowledge Selected
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setStatusFilter('acknowledged')}
            >
              View Acknowledged
            </Button>
            <button
              onClick={() => setSelectedEvents(new Set())}
              className="p-2 text-neutral-500 dark:text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="card" height={80} />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <motion.div variants={itemVariants} className="text-center py-16">
          <div className="w-16 h-16 bg-white dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-neutral-400 dark:text-white/30" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No drift events found</h3>
          <p className="text-neutral-500 dark:text-white/50">No schema changes detected matching your filters.</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredEvents.map((event) => (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className={`${event.resolved ? 'opacity-60' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selectedEvents.has(event.id)}
                        onChange={() => toggleEventSelection(event.id)}
                        className="mt-1 w-4 h-4 rounded border-white/20 bg-white dark:bg-white/5 text-primary-500 focus:ring-primary-500/20"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${
                                event.method === 'GET' ? 'bg-primary-500/20 text-primary-400 border-primary-500/30' :
                                event.method === 'POST' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                              }`}>
                                {event.method}
                              </span>
                              <span className="text-white font-medium">{event.endpointName}</span>
                              <UrlLink
                                url={event.endpointUrl}
                                className="text-neutral-500 dark:text-white/40 text-sm font-mono underline-offset-4 hover:text-white hover:underline"
                              />
                            </div>
                            <p className="text-sm text-neutral-600 dark:text-white/70">{event.message}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge severity={event.severity}>{event.severity}</Badge>
                            {event.resolved && (
                              <Badge status="active">Resolved</Badge>
                            )}
                            {event.acknowledged && !event.resolved && (
                              <Badge status="active">Acknowledged</Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                          <span className="text-xs text-neutral-500 dark:text-white/40">
                            {formatDateTime(event.detectedAt)}
                          </span>
                          <button
                            onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                            className="flex items-center gap-1 text-sm text-neutral-500 dark:text-white/50 hover:text-white transition-colors"
                          >
                            {expandedEvent === event.id ? 'Hide' : 'Show'} changes
                            <ChevronDown className={`w-4 h-4 transition-transform ${expandedEvent === event.id ? 'rotate-180' : ''}`} />
                          </button>
                        </div>

                        <AnimatePresence>
                          {expandedEvent === event.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="mt-4 pt-4 border-t border-neutral-200 dark:border-white/10"
                            >
                              <div className="space-y-4">
                                <div className="relative rounded-2xl border border-neutral-200 dark:border-white/10 bg-black/20 dark:bg-black/30 p-4 font-mono text-sm leading-7 text-white/85">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyText(
                                        [
                                          `Endpoint: ${event.method} ${event.endpointUrl}`,
                                          `Change: ${changeListSummary(event.changes)}`,
                                          `Severity: ${event.severity}`,
                                          `Time: ${formatRelativeTime(event.detectedAt)}`,
                                        ].join('\n')
                                      )
                                    }
                                    className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-500 dark:text-white/50 hover:bg-white/10 hover:text-white"
                                    aria-label="Copy change summary"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </button>
                                  <p>
                                    <span className="text-white">Endpoint:</span> {event.method}{' '}
                                    <UrlLink
                                      url={event.endpointUrl}
                                      className="underline-offset-4 hover:text-white hover:underline"
                                    />
                                  </p>
                                  <p><span className="text-white">Change:</span> {changeListSummary(event.changes)}</p>
                                  <p><span className="text-white">Severity:</span> {event.severity.charAt(0).toUpperCase() + event.severity.slice(1)}</p>
                                  <p><span className="text-white">Time:</span> {formatRelativeTime(event.detectedAt)}</p>
                                </div>

                                <div className="relative rounded-2xl border border-neutral-200 dark:border-white/10 bg-black/20 dark:bg-black/30 p-4">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyText(
                                        [
                                          'Diff',
                                          '',
                                          'Old Schema',
                                          ...(diffLines(event.changes, 'old').length ? diffLines(event.changes, 'old') : ['No previous fields changed']),
                                          '',
                                          'New Schema',
                                          ...(diffLines(event.changes, 'new').length ? diffLines(event.changes, 'new') : ['No new fields changed']),
                                        ].join('\n')
                                      )
                                    }
                                    className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-500 dark:text-white/50 hover:bg-white/10 hover:text-white"
                                    aria-label="Copy schema diff"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </button>
                                  <div className="mb-6 flex items-center gap-3 text-white">
                                    <Code2 className="h-4 w-4" />
                                    <h3 className="font-semibold">Diff</h3>
                                  </div>
                                  <div className="grid gap-6 font-mono text-sm leading-7 text-white/85 md:grid-cols-2">
                                    <div>
                                      <p className="mb-2 font-semibold text-white">Old Schema</p>
                                      {diffLines(event.changes, 'old').length ? (
                                        diffLines(event.changes, 'old').map((line, index) => (
                                          <p key={index} className="font-semibold text-red-300">{line}</p>
                                        ))
                                      ) : (
                                        <p className="text-white/45">No previous fields changed</p>
                                      )}
                                    </div>
                                    <div>
                                      <p className="mb-2 font-semibold text-white">New Schema</p>
                                      {diffLines(event.changes, 'new').length ? (
                                        diffLines(event.changes, 'new').map((line, index) => (
                                          <p key={index} className="font-semibold text-green-300">{line}</p>
                                        ))
                                      ) : (
                                        <p className="text-white/45">No new fields changed</p>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                  {event.changes.map((change, index) => (
                                    <div key={index} className="rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 p-3">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                          change.type === 'added' ? 'bg-green-500/20 text-green-400' :
                                          change.type === 'removed' ? 'bg-red-500/20 text-red-400' :
                                          'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                          {change.type}
                                        </span>
                                        <span className="text-sm font-mono text-neutral-800 dark:text-white/80">{change.path || change.field}</span>
                                      </div>
                                      <p className="mt-2 text-sm text-neutral-600 dark:text-white/70">{changeSummary(change)}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-4">
                                {!event.acknowledged && canUpdateDrifts && (
                                  <Button size="sm" leftIcon={<Check className="w-4 h-4" />} onClick={() => void acknowledgeEvent(event.id)}>
                                    Acknowledge
                                  </Button>
                                )}
                                {event.acknowledged && !event.resolved && (
                                  <Button size="sm" variant="ghost" onClick={() => setStatusFilter('acknowledged')}>
                                    View acknowledged queue
                                  </Button>
                                )}
                                {!event.resolved && canUpdateDrifts && (
                                  <Button size="sm" variant="secondary" onClick={() => void resolveEvent(event.id)}>
                                    Mark Resolved
                                  </Button>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
