import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { useAuthStore, useEndpointStore, useNotificationStore, useProjectStore, type Endpoint } from '@/store';
import { api } from '@/services/api';
import { Card, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Badge } from '@/components/common/Badge';
import { Skeleton } from '@/components/common/Skeleton';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import { Dropdown, DropdownTrigger, type DropdownItem } from '@/components/common/Dropdown';
import {
  AlertTriangle,
  CheckCircle,
  Edit,
  Eye,
  Filter,
  History,
  LayoutGrid,
  List,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import type { ProjectRole } from '@/utils/permissions';
import { hasProjectPermission } from '@/utils/permissions';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const statuses = ['healthy', 'warning', 'drifted', 'failed', 'disabled'] as const;

const methodColors: Record<Endpoint['method'], string> = {
  GET: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  POST: 'bg-green-500/20 text-green-400 border-green-500/30',
  PUT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  PATCH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const statusLabels: Record<NonNullable<Endpoint['status']>, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  drifted: 'Drifted',
  failed: 'Failed',
  disabled: 'Disabled',
};

type ModalMode = 'add' | 'details' | 'edit' | 'history' | 'delete' | null;

type EndpointForm = {
  name: string;
  url: string;
  method: Endpoint['method'];
  headers: string;
  body: string;
  frequency: string;
  monitoringEnabled: boolean;
  schema: string;
};

type TeamMember = {
  id: string;
  userEmail: string;
  role: ProjectRole;
  status?: 'pending' | 'active' | 'removed' | 'invited' | 'joined';
};

const endpointFormSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'URL is required')
    .refine((value) => /^https?:\/\//i.test(value) || value.startsWith('/'), 'Use a full URL or a path starting with /.'),
  method: z.enum(methods),
});

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const diffInMinutes = Math.floor((Date.now() - date.getTime()) / 1000 / 60);

  if (Number.isNaN(diffInMinutes) || diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return `${Math.floor(diffInMinutes / 1440)}d ago`;
}

function endpointStatus(endpoint: Endpoint): NonNullable<Endpoint['status']> {
  if (endpoint.status) return endpoint.status;
  return endpoint.lastDriftAt ? 'drifted' : 'healthy';
}

function stringifyJson(value: unknown, fallback = '') {
  if (value === undefined || value === null || value === '') return fallback;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return fallback;
  }
}

function parseJsonInput(value: string, fallback: unknown) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return JSON.parse(trimmed);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message || fallback);
  }
  return fallback;
}

function parseJsonField(value: string, fallback: unknown, label: string) {
  try {
    return parseJsonInput(value, fallback);
  } catch {
    throw new Error(`${label} must be valid JSON. Check commas, braces, and quotes.`);
  }
}

function parseOptionalJsonObject(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = parseJsonField(trimmed, undefined, label);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a valid JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function buildForm(endpoint?: Endpoint): EndpointForm {
  return {
    name: endpoint?.name || '',
    url: endpoint?.url || '',
    method: endpoint?.method || 'GET',
    headers: stringifyJson(endpoint?.headers, '{}'),
    body: stringifyJson(endpoint?.body, ''),
    frequency: endpoint?.frequency || '5m',
    monitoringEnabled: endpoint?.monitoringEnabled !== false,
    schema: endpoint ? stringifyJson(endpoint.currentSchema, '{}') : '',
  };
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

export default function EndpointsPage() {
  const { currentProject } = useProjectStore();
  const { user } = useAuthStore();
  const { fetchNotifications, fetchUnreadCount } = useNotificationStore();
  const {
    endpoints,
    schemaHistory,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    fetchEndpoints,
    fetchSchemaHistory,
    createEndpoint,
    updateEndpoint,
    deleteEndpoint,
    refreshEndpoint,
  } = useEndpointStore();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<Endpoint['method'] | null>(null);
  const [statusFilter, setStatusFilter] = useState<NonNullable<Endpoint['status']> | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
  const [form, setForm] = useState<EndpointForm>(() => buildForm());
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [projectRole, setProjectRole] = useState<ProjectRole | null>(currentProject?.currentUserRole || null);
  const endpointsPerPage = 9;
  const canEditEndpoints = hasProjectPermission(projectRole, 'endpoint:update');

  const selectedEndpoint = endpoints.find((endpoint) => endpoint.id === selectedEndpointId) || null;

  useEffect(() => {
    if (currentProject?.id) {
      void fetchEndpoints(currentProject.id);
    }
  }, [currentProject?.id, fetchEndpoints]);

  useEffect(() => {
    if (!currentProject?.id || !user?.email) {
      setProjectRole(null);
      return;
    }
    if (currentProject.currentUserRole) {
      setProjectRole(currentProject.currentUserRole);
      return;
    }
    if (currentProject.ownerId === user.id) {
      setProjectRole('owner');
      return;
    }
    api.get<TeamMember[]>(`/team/${currentProject.id}`)
      .then((members) => {
        const member = members.find((item) => item.userEmail.toLowerCase() === user.email.toLowerCase());
        setProjectRole(member?.role || null);
      })
      .catch(() => setProjectRole(null));
  }, [currentProject?.currentUserRole, currentProject?.id, currentProject?.ownerId, user?.email, user?.id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, methodFilter, statusFilter, currentProject?.id]);

  const filteredEndpoints = useMemo(
    () =>
      endpoints.filter((endpoint) => {
        const query = search.trim().toLowerCase();
        const status = endpointStatus(endpoint);
        if (query && !endpoint.name.toLowerCase().includes(query) && !endpoint.url.toLowerCase().includes(query)) return false;
        if (methodFilter && endpoint.method !== methodFilter) return false;
        if (statusFilter && status !== statusFilter) return false;
        return true;
      }),
    [endpoints, methodFilter, search, statusFilter]
  );

  const totalPages = Math.max(1, Math.ceil(filteredEndpoints.length / endpointsPerPage));
  const paginatedEndpoints = filteredEndpoints.slice((currentPage - 1) * endpointsPerPage, currentPage * endpointsPerPage);

  const openModal = async (mode: ModalMode, endpoint?: Endpoint) => {
    if ((mode === 'add' || mode === 'edit' || mode === 'delete') && !canEditEndpoints) {
      toast.error('Viewers can only view this project. Ask an admin for edit access.');
      return;
    }
    setModalMode(mode);
    setSelectedEndpointId(endpoint?.id || null);
    setForm(buildForm(endpoint));
    if (mode === 'history' && endpoint) {
      await fetchSchemaHistory(endpoint.id);
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedEndpointId(null);
    setForm(buildForm());
  };

  const saveEndpoint = async () => {
    if (!canEditEndpoints) {
      toast.error('Viewers can only view this project. Ask an admin for edit access.');
      return;
    }
    if (!currentProject?.id) {
      toast.error('Connect a project before adding endpoints.');
      return;
    }

    try {
      const validated = endpointFormSchema.parse({ url: form.url, method: form.method });
      const headers = parseJsonField(form.headers, {}, 'Headers') as Record<string, string>;
      const body = parseJsonField(form.body, undefined, 'Body');
      const currentSchema = parseOptionalJsonObject(form.schema, 'Initial Schema');
      const payload = {
        name: form.name.trim() || `${form.method} ${form.url.trim()}`,
        url: validated.url,
        method: validated.method,
        headers,
        body,
        frequency: form.frequency.trim() || '5m',
        monitoringEnabled: form.monitoringEnabled,
        ...(currentSchema ? { currentSchema } : {}),
      };

      if (modalMode === 'edit' && selectedEndpoint) {
        await updateEndpoint(selectedEndpoint.id, payload);
        toast.success('Endpoint updated.');
      } else {
        await createEndpoint(currentProject.id, { ...payload, currentSchemaVersion: currentSchema ? 1 : 0, lastCheckedAt: new Date().toISOString() });
        toast.success('Endpoint added.');
      }

      closeModal();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.issues[0]?.message || 'Endpoint form is invalid.');
        return;
      }
      toast.error(getErrorMessage(error, 'Endpoint save failed.'));
    }
  };

  const confirmDelete = async () => {
    if (!selectedEndpoint) return;
    if (!canEditEndpoints) {
      toast.error('Viewers can only view this project. Ask an admin for edit access.');
      return;
    }
    try {
      await deleteEndpoint(selectedEndpoint.id);
      toast.success('Endpoint deleted.');
      closeModal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Endpoint delete failed.');
    }
  };

  const refreshOne = async (endpoint: Endpoint) => {
    if (!canEditEndpoints) {
      toast.error('Viewers can only view this project. Ask an admin for edit access.');
      return;
    }
    setRefreshingId(endpoint.id);
    try {
      const result = await refreshEndpoint(endpoint.id);
      await Promise.all([fetchNotifications(), fetchUnreadCount()]);
      toast.success(result.failure ? `${endpoint.name} failed before schema comparison. Check the URL or API server.` : result.changed ? `${endpoint.name} drift detected and version history updated.` : `${endpoint.name} refreshed. No schema drift detected.`);
      if (modalMode === 'history') {
        await fetchSchemaHistory(endpoint.id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Endpoint refresh failed.');
    } finally {
      setRefreshingId(null);
    }
  };

  const refreshAll = async () => {
    if (!currentProject?.id) return;
    if (!canEditEndpoints) {
      toast.error('Viewers can only view this project. Ask an admin for edit access.');
      return;
    }
    setRefreshingId('all');
    try {
      await Promise.all(endpoints.filter((endpoint) => endpoint.monitoringEnabled !== false).map((endpoint) => refreshEndpoint(endpoint.id)));
      await Promise.all([fetchNotifications(), fetchUnreadCount()]);
      toast.success('Endpoint statuses refreshed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Some endpoints could not be refreshed.');
    } finally {
      setRefreshingId(null);
    }
  };

  const getActions = (endpoint: Endpoint): DropdownItem[] => [
    { label: 'View Details', value: 'details', icon: <Eye className="w-4 h-4" />, onClick: () => void openModal('details', endpoint) },
    { label: 'Edit', value: 'edit', icon: <Edit className="w-4 h-4" />, disabled: !canEditEndpoints, onClick: () => void openModal('edit', endpoint) },
    { label: 'View History', value: 'history', icon: <History className="w-4 h-4" />, onClick: () => void openModal('history', endpoint) },
    { label: 'Refresh Status', value: 'refresh', icon: <RefreshCw className="w-4 h-4" />, disabled: !canEditEndpoints, onClick: () => void refreshOne(endpoint) },
    { divider: true, label: '' },
    { label: 'Delete', value: 'delete', icon: <Trash2 className="w-4 h-4" />, disabled: !canEditEndpoints, onClick: () => void openModal('delete', endpoint) },
  ];

  const renderEndpointCard = (endpoint: Endpoint) => {
    const status = endpointStatus(endpoint);
    const isRefreshing = refreshingId === endpoint.id;

    return (
      <Card className="h-full">
        <CardContent className="flex h-full flex-col">
          <div className="mb-3 flex items-start justify-between">
            <span className={`rounded border px-2 py-1 text-xs font-medium ${methodColors[endpoint.method]}`}>{endpoint.method}</span>
            <Dropdown
              trigger={
                <button className="p-1 text-white/40 transition-colors hover:text-white">
                  <MoreVertical className="w-4 h-4" />
                </button>
              }
              items={getActions(endpoint)}
              align="end"
            />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-white">{endpoint.name}</h3>
          <UrlLink
            url={endpoint.url}
            className="mb-4 break-all font-mono text-sm text-white/50 underline-offset-4 hover:text-white hover:underline"
          />
          <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <p className="text-white/40">Response</p>
              <p className="mt-1 text-white">{endpoint.responseTime ?? 0} ms</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <p className="text-white/40">Health</p>
              <p className="mt-1 text-white">{endpoint.health ?? 100}%</p>
            </div>
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge severity={status === 'drifted' || status === 'failed' ? 'breaking' : status === 'warning' ? 'medium' : 'low'} showDot>
                {statusLabels[status]}
              </Badge>
              <Badge severity={endpoint.monitoringEnabled === false ? 'medium' : 'low'}>
                {endpoint.monitoringEnabled === false ? 'Monitoring disabled' : 'Monitoring enabled'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <span>v{endpoint.currentSchemaVersion}</span>
              <span>.</span>
              <span>{formatRelativeTime(endpoint.lastCheckedAt || endpoint.updatedAt)}</span>
              <button
                onClick={() => void refreshOne(endpoint)}
                disabled={isRefreshing || !canEditEndpoints}
                className="ml-1 rounded p-1 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-40"
                aria-label={`Refresh ${endpoint.name}`}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Endpoints</h1>
          <p className="text-white/60">Manage and monitor real API endpoints for the active project.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" leftIcon={<RefreshCw className={`w-4 h-4 ${refreshingId === 'all' ? 'animate-spin' : ''}`} />} onClick={() => void refreshAll()} disabled={!endpoints.length || !canEditEndpoints}>
            Refresh Endpoints
          </Button>
          <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => void openModal('add')} disabled={!canEditEndpoints}>
            Add Endpoint
          </Button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="relative z-30 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="min-w-[220px] flex-1">
              <Input placeholder="Search endpoints..." value={search} onChange={(e) => setSearch(e.target.value)} variant="search" leftIcon={<Search className="w-4 h-4" />} />
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
              <Dropdown
                align="start"
                trigger={
                  <DropdownTrigger className="min-w-[120px] justify-between">
                    <Filter className="w-4 h-4" />
                    {methodFilter || 'Method'}
                  </DropdownTrigger>
                }
                items={[
                  { label: 'All Methods', value: '', onClick: () => setMethodFilter(null) },
                  ...methods.map((method) => ({ label: method, value: method, onClick: () => setMethodFilter(method) })),
                ]}
              />
              <Dropdown
                align="start"
                trigger={<DropdownTrigger className="min-w-[140px] justify-between">Status: {statusFilter ? statusLabels[statusFilter] : 'All'}</DropdownTrigger>}
                items={[
                  { label: 'All Status', value: '', onClick: () => setStatusFilter(null) },
                  ...statuses.map((status) => ({ label: statusLabels[status], value: status, onClick: () => setStatusFilter(status) })),
                ]}
              />
              <div className="flex h-10 items-center overflow-hidden rounded-lg border border-white/10">
                <button onClick={() => setViewMode('grid')} className={`grid h-10 w-10 place-items-center ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}>
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('list')} className={`grid h-10 w-10 place-items-center ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}>
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((index) => (
            <Skeleton.Card key={index} />
          ))}
        </div>
      ) : paginatedEndpoints.length === 0 ? (
        <motion.div variants={itemVariants} className="py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
            <Search className="h-8 w-8 text-white/30" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-white">No endpoints found</h3>
          <p className="mb-4 text-white/50">{search || methodFilter || statusFilter ? 'Try adjusting your filters.' : 'Add an endpoint to begin live monitoring.'}</p>
          <Button onClick={() => void openModal('add')} leftIcon={<Plus className="w-4 h-4" />} disabled={!canEditEndpoints}>
            Add Endpoint
          </Button>
        </motion.div>
      ) : viewMode === 'grid' ? (
        <motion.div variants={containerVariants} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedEndpoints.map((endpoint) => (
            <motion.div key={endpoint.id} variants={itemVariants}>
              {renderEndpointCard(endpoint)}
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="space-y-2">
          {paginatedEndpoints.map((endpoint) => {
            const status = endpointStatus(endpoint);
            return (
              <motion.div key={endpoint.id} variants={itemVariants}>
                <Card className="py-3">
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <span className={`rounded border px-2 py-1 text-xs font-medium ${methodColors[endpoint.method]}`}>{endpoint.method}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-white">{endpoint.name}</p>
                        <UrlLink
                          url={endpoint.url}
                          className="break-all font-mono text-sm text-white/50 underline-offset-4 hover:text-white hover:underline"
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge severity={status === 'healthy' ? 'low' : status === 'warning' ? 'medium' : 'breaking'}>{statusLabels[status]}</Badge>
                      <Badge severity={endpoint.monitoringEnabled === false ? 'medium' : 'low'}>
                        {endpoint.monitoringEnabled === false ? 'Disabled' : 'Monitoring'}
                      </Badge>
                      <span className="text-sm text-white/40">v{endpoint.currentSchemaVersion}</span>
                      <Button variant="ghost" size="sm" leftIcon={<RefreshCw className={`w-4 h-4 ${refreshingId === endpoint.id ? 'animate-spin' : ''}`} />} onClick={() => void refreshOne(endpoint)} disabled={!canEditEndpoints}>
                        Refresh
                      </Button>
                      <Dropdown trigger={<button className="p-1 text-white/40 hover:text-white"><MoreVertical className="w-4 h-4" /></button>} items={getActions(endpoint)} />
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
          <p className="text-sm text-white/50">
            Showing {(currentPage - 1) * endpointsPerPage + 1} to {Math.min(currentPage * endpointsPerPage, filteredEndpoints.length)} of {filteredEndpoints.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)}>Previous</Button>
            <Button variant="ghost" size="sm" disabled>{currentPage} / {totalPages}</Button>
            <Button variant="secondary" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => page + 1)}>Next</Button>
          </div>
        </motion.div>
      )}

      <Modal isOpen={modalMode === 'add'} onClose={closeModal} size="lg">
        <ModalHeader><h2 className="text-xl font-semibold text-white">Add Endpoint</h2></ModalHeader>
        <EndpointFormFields form={form} setForm={setForm} />
        <ModalFooter>
          <Button variant="secondary" onClick={closeModal}>Cancel</Button>
          <Button loading={isCreating} onClick={() => void saveEndpoint()}>Add Endpoint</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={modalMode === 'edit'} onClose={closeModal} size="lg">
        <ModalHeader><h2 className="text-xl font-semibold text-white">Edit Endpoint</h2></ModalHeader>
        <EndpointFormFields form={form} setForm={setForm} />
        <ModalFooter>
          <Button variant="secondary" onClick={closeModal}>Cancel</Button>
          <Button loading={isUpdating} onClick={() => void saveEndpoint()}>Save Changes</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={modalMode === 'details'} onClose={closeModal} size="lg">
        <ModalHeader><h2 className="text-xl font-semibold text-white">{selectedEndpoint?.name || 'Endpoint Details'}</h2></ModalHeader>
        <ModalBody className="space-y-4">
          {selectedEndpoint && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Method" value={selectedEndpoint.method} />
                <Detail label="Status" value={statusLabels[endpointStatus(selectedEndpoint)]} />
                <Detail label="Response time" value={`${selectedEndpoint.responseTime ?? 0} ms`} />
                <Detail label="Health" value={`${selectedEndpoint.health ?? 100}%`} />
                <Detail label="Monitoring" value={selectedEndpoint.monitoringEnabled === false ? 'Disabled' : 'Enabled'} />
                <Detail label="Last checked" value={formatRelativeTime(selectedEndpoint.lastCheckedAt)} />
                <Detail label="Schema version" value={`v${selectedEndpoint.currentSchemaVersion}`} />
              </div>
              <Button
                variant="secondary"
                leftIcon={<RefreshCw className={`w-4 h-4 ${refreshingId === selectedEndpoint.id ? 'animate-spin' : ''}`} />}
                loading={refreshingId === selectedEndpoint.id}
                onClick={() => void refreshOne(selectedEndpoint)}
                disabled={!canEditEndpoints}
              >
                Refresh / Recheck Endpoint
              </Button>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-white/50">URL</p>
                <UrlLink
                  url={selectedEndpoint.url}
                  className="mt-1 block break-all font-mono text-sm font-semibold text-white underline-offset-4 hover:text-indigo-200 hover:underline"
                />
              </div>
              <pre className="max-h-72 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-white/70">{stringifyJson(selectedEndpoint.currentSchema, '{}')}</pre>
            </>
          )}
        </ModalBody>
      </Modal>

      <Modal isOpen={modalMode === 'history'} onClose={closeModal} size="xl">
        <ModalHeader><h2 className="text-xl font-semibold text-white">{selectedEndpoint?.name || 'Endpoint'} History</h2></ModalHeader>
        <ModalBody className="space-y-3">
          {schemaHistory.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/60">No schema history has been captured for this endpoint yet.</p>
          ) : (
            schemaHistory.map((version) => (
              <div key={version.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">Version {version.version}</p>
                    <p className="text-xs text-white/45">{new Date(version.createdAt).toLocaleString()} by {version.createdBy}</p>
                  </div>
                  <Badge severity="low">{version.changelog || 'Schema snapshot'}</Badge>
                </div>
                <pre className="max-h-48 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-white/70">{stringifyJson(version.schema, '{}')}</pre>
              </div>
            ))
          )}
        </ModalBody>
      </Modal>

      <Modal isOpen={modalMode === 'delete'} onClose={closeModal} size="md">
        <ModalHeader><h2 className="text-xl font-semibold text-white">Delete Endpoint</h2></ModalHeader>
        <ModalBody>
          <div className="flex gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>Delete {selectedEndpoint?.name}? This removes the endpoint from monitoring and resolves related drift events.</p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={closeModal}>Cancel</Button>
          <Button variant="danger" loading={isDeleting} onClick={() => void confirmDelete()}>Delete</Button>
        </ModalFooter>
      </Modal>
    </motion.div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-xs text-white/50">{label}</p>
      <p className={`mt-1 text-sm font-semibold text-white ${mono ? 'break-all font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function EndpointFormFields({ form, setForm }: { form: EndpointForm; setForm: React.Dispatch<React.SetStateAction<EndpointForm>> }) {
  return (
    <ModalBody className="space-y-4">
      <Input label="Name" placeholder="e.g., Get Users" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
      <div>
        <Input label="URL" placeholder="http://127.0.0.1:8000/users" value={form.url} onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} />
        <p className="mt-2 text-xs font-medium text-white/55">
          Use a full URL, or use a path like /users when the project has an API base URL.
        </p>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-white/80">Method</label>
        <div className="flex flex-wrap gap-2">
          {methods.map((method) => (
            <button
              key={method}
              onClick={() => setForm((current) => ({ ...current, method }))}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${method === form.method ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 text-white/60 hover:border-white/20'}`}
            >
              {method}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <Input label="Monitoring frequency" placeholder="5m" value={form.frequency} onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value }))} />
        <label className="flex items-end gap-2 pb-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={form.monitoringEnabled}
            onChange={(event) => setForm((current) => ({ ...current, monitoringEnabled: event.target.checked }))}
            className="h-4 w-4 accent-indigo-500"
          />
          Monitoring
        </label>
      </div>
      <JsonTextArea label="Headers (JSON)" value={form.headers} onChange={(headers) => setForm((current) => ({ ...current, headers }))} placeholder='{"Authorization":"Bearer token"}' />
      <JsonTextArea label="Body (JSON, optional)" value={form.body} onChange={(body) => setForm((current) => ({ ...current, body }))} placeholder='{"sample": true}' />
      <JsonTextArea label="Initial Schema (JSON, optional)" value={form.schema} onChange={(schema) => setForm((current) => ({ ...current, schema }))} placeholder='Leave empty to capture from the first successful response' />
      <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/55">
        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
        <span className="min-w-0">
          Headers, Body, and manual Initial Schema must be complete JSON objects. Leave Initial Schema empty to let DriftBoard capture the baseline automatically from the first successful response.
        </span>
      </div>
    </ModalBody>
  );
}

function JsonTextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-white/80">{label}</label>
      <textarea
        className="h-28 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-mono text-sm text-white focus:border-white/30 focus:outline-none"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
