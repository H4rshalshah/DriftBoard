import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useEndpointStore, useProjectStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Skeleton } from '@/components/common/Skeleton';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import { Dropdown, DropdownTrigger } from '@/components/common/Dropdown';
import {
  History,
  GitBranch,
  Eye,
  RotateCcw,
  ArrowRightLeft,
  Calendar,
  User,
  Download,
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

const schemaPreviewClass =
  'schema-code-block whitespace-pre-wrap break-words rounded-lg border border-neutral-200 dark:border-white/10 bg-black p-4 font-mono leading-6 text-slate-100 shadow-inner';

interface SchemaVersion {
  id: string;
  version: number;
  createdAt: string;
  createdBy: string;
  changelog?: string;
  schema: Record<string, unknown>;
}

interface EndpointOption {
  id: string;
  name: string;
  url: string;
  method: string;
  currentSchemaVersion: number;
  schemaVersions: SchemaVersion[];
}

const mockEndpoints = [
  { id: '1', name: 'Get Users', url: '/api/v1/users', method: 'GET' },
  { id: '2', name: 'Create User', url: '/api/v1/users', method: 'POST' },
  { id: '3', name: 'Update Product', url: '/api/v1/products/:id', method: 'PUT' },
  { id: '4', name: 'List Orders', url: '/api/v1/orders', method: 'GET' },
];

const mockVersions: SchemaVersion[] = [
  {
    id: 'v5',
    version: 5,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    createdBy: 'john@example.com',
    changelog: 'Added category field',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string', maxLength: 100 },
        price: { type: 'number', minimum: 0 },
        category: { type: 'string', enum: ['electronics', 'clothing', 'food'] },
        inStock: { type: 'boolean' },
      },
      required: ['id', 'name', 'price'],
    },
  },
  {
    id: 'v4',
    version: 4,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    createdBy: 'jane@example.com',
    changelog: 'Updated price field type',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string', maxLength: 100 },
        price: { type: 'integer' },
        inStock: { type: 'boolean' },
      },
      required: ['id', 'name', 'price'],
    },
  },
  {
    id: 'v3',
    version: 3,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    createdBy: 'john@example.com',
    changelog: 'Added inStock field',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string', maxLength: 100 },
        price: { type: 'number' },
        inStock: { type: 'boolean' },
      },
      required: ['id', 'name'],
    },
  },
  {
    id: 'v2',
    version: 2,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    createdBy: 'admin@example.com',
    changelog: 'Initial version',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        price: { type: 'number' },
      },
      required: ['id', 'name'],
    },
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

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadTextFile(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([`\uFEFF${text}`], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace(/[\\/:*?"<>|]+/g, '-');
  link.style.display = 'none';
  document.body.appendChild(link);
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SchemaHistoryPage() {
  const { currentProject } = useProjectStore();
  const { endpoints, isLoading, isUpdating, fetchEndpoints, rollbackSchema } = useEndpointStore();
  const [selectedEndpoint, setSelectedEndpoint] = useState(mockEndpoints[0].id);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<SchemaVersion | null>(mockVersions[0]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  useEffect(() => {
    if (currentProject?.id) {
      void fetchEndpoints(currentProject.id);
    }
  }, [currentProject?.id, fetchEndpoints]);

  const endpointOptions = useMemo<EndpointOption[]>(() => {
    const projectEndpoints = currentProject?.id
      ? endpoints.filter((endpoint) => endpoint.projectId === currentProject.id)
      : [];

    return projectEndpoints.length > 0
      ? projectEndpoints.map((endpoint) => ({
          id: endpoint.id,
          name: endpoint.name,
          url: endpoint.url,
          method: endpoint.method,
          currentSchemaVersion: endpoint.currentSchemaVersion,
          schemaVersions: endpoint.schemaVersions,
        }))
      : mockEndpoints.map((endpoint) => ({ ...endpoint, currentSchemaVersion: mockVersions[0].version, schemaVersions: mockVersions }));
  }, [currentProject?.id, endpoints]);

  useEffect(() => {
    if (endpointOptions.length > 0 && !endpointOptions.some((endpoint) => endpoint.id === selectedEndpoint)) {
      setSelectedEndpoint(endpointOptions[0].id);
    }
  }, [endpointOptions, selectedEndpoint]);

  const currentEndpoint = endpointOptions.find((e) => e.id === selectedEndpoint);
  const canUpdateSchema = hasProjectPermission(currentProject?.currentUserRole, 'schema:update');
  const versions = useMemo(
    () => {
      if (currentEndpoint?.schemaVersions?.length) {
        return currentEndpoint.schemaVersions
          .map((version) => ({
            id: version.id,
            version: version.version,
            createdAt: version.createdAt,
            createdBy: version.createdBy,
            changelog: version.changelog,
            schema: version.schema,
          }))
          .sort((left, right) => right.version - left.version);
      }
      return currentProject?.id ? [] : mockVersions;
    },
    [currentEndpoint?.schemaVersions, currentProject?.id]
  );

  useEffect(() => {
    setSelectedVersions((current) => current.filter((versionId) => versions.some((version) => version.id === versionId)));

    if (versions.length === 0) {
      setPreviewVersion(null);
      return;
    }

    setPreviewVersion((current) => {
      const freshCurrentVersion = current ? versions.find((version) => version.id === current.id) : null;
      if (freshCurrentVersion) return freshCurrentVersion;
      const activeVersion = versions.find((version) => version.version === currentEndpoint?.currentSchemaVersion);
      if (activeVersion) return activeVersion;
      return versions[0];
    });
  }, [currentEndpoint?.currentSchemaVersion, selectedEndpoint, versions]);

  const handleVersionSelect = (versionId: string) => {
    if (selectedVersions.includes(versionId)) {
      setSelectedVersions(selectedVersions.filter((v) => v !== versionId));
    } else if (selectedVersions.length < 2) {
      setSelectedVersions([...selectedVersions, versionId]);
    }
  };

  const handlePreview = (version: SchemaVersion) => {
    setPreviewVersion(version);
    setShowPreviewModal(true);
  };

  const handleCompare = () => {
    if (selectedVersions.length === 2) {
      setShowCompareModal(true);
    }
  };

  const exportSchemaCsv = () => {
    const rows = versions.map((version) => [
      currentProject?.name || 'DriftBoard Project',
      currentEndpoint?.name || '',
      currentEndpoint?.method || '',
      currentEndpoint?.url || '',
      version.version,
      version.version === currentEndpoint?.currentSchemaVersion ? 'current' : 'historical',
      version.createdAt,
      version.createdBy,
      version.changelog || '',
      JSON.stringify(version.schema),
    ]);
    const csv = [
      ['project', 'endpointName', 'method', 'url', 'schemaVersion', 'status', 'createdAt', 'createdBy', 'changelog', 'schemaJson'],
      ...rows,
    ].map((row) => row.map(csvCell).join(',')).join('\n');
    downloadTextFile(`schema-history-${currentEndpoint?.name || 'endpoint'}.csv`, csv);
  };

  const compareVersions = selectedVersions
    .map((versionId) => versions.find((version) => version.id === versionId))
    .filter((version): version is SchemaVersion => Boolean(version));

  const handleRollback = async (versionId: string) => {
    if (!canUpdateSchema) return;
    if (!currentEndpoint || !currentProject?.id) return;
    try {
      await rollbackSchema(currentEndpoint.id, versionId);
      if (currentProject?.id) await fetchEndpoints(currentProject.id);
      setSelectedVersions([]);
      setShowPreviewModal(false);
      toast.success('Schema rolled back.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Schema rollback failed.';
      toast.error(message);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Schema History</h1>
          <p className="text-neutral-500 dark:text-white/60">
            {currentProject?.name ? `View and compare schema versions for ${currentProject.name}.` : 'View and compare schema versions'}
          </p>
        </div>
        <Button variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={exportSchemaCsv} disabled={versions.length === 0}>
          Export CSV
        </Button>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-800 dark:text-white/80 mb-1.5">Select Endpoint</label>
              <Dropdown
                trigger={
                  <DropdownTrigger className="min-w-[230px] justify-between">
                    {currentEndpoint?.method && (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded border mr-2 ${
                        currentEndpoint.method === 'GET' ? 'bg-primary-500/20 text-primary-400 border-primary-500/30' : 'bg-green-500/20 text-green-400 border-green-500/30'
                      }`}>
                        {currentEndpoint.method}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-left">{currentEndpoint?.name || 'Select endpoint'}</span>
                  </DropdownTrigger>
                }
                items={endpointOptions.map((endpoint) => ({
                  label: `${endpoint.method} ${endpoint.name}`,
                  value: endpoint.id,
                  onClick: () => setSelectedEndpoint(endpoint.id),
                }))}
              />
            </div>
            {selectedVersions.length === 2 && (
              <Button
                leftIcon={<ArrowRightLeft className="w-4 h-4" />}
                onClick={handleCompare}
                className="mt-5"
              >
                Compare Selected
              </Button>
            )}
          </div>
        </Card>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-neutral-500 dark:text-white/50" />
                  Version Timeline
                </CardTitle>
                <Badge>{versions.length} versions</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} variant="card" height={60} />
                  ))}
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-white/10" />
                  {versions.map((version, index) => (
                    <motion.div
                      key={version.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="relative flex items-start gap-4 pb-6 last:pb-0"
                    >
                      <div className={`version-dot relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                        selectedVersions.includes(version.id)
                          ? 'version-dot-selected border-primary-500'
                          : 'version-dot-idle border-white/20'
                      }`}>
                        <span className="text-xs font-semibold">v{version.version}</span>
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedVersions.includes(version.id)}
                              onChange={() => handleVersionSelect(version.id)}
                              disabled={!selectedVersions.includes(version.id) && selectedVersions.length >= 2}
                              className="w-4 h-4 rounded border-white/20 bg-white dark:bg-white/5 text-primary-500"
                            />
                            <span className="text-white font-medium">Version {version.version}</span>
                            {version.version === currentEndpoint?.currentSchemaVersion && <Badge severity="low">Current</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              leftIcon={<Eye className="w-3 h-3" />}
                              onClick={() => handlePreview(version)}
                            >
                              Preview
                            </Button>
                            {version.version !== currentEndpoint?.currentSchemaVersion && canUpdateSchema && (
                              <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={<RotateCcw className="w-3 h-3" />}
                                loading={isUpdating}
                                onClick={() => void handleRollback(version.id)}
                              >
                                Rollback
                              </Button>
                            )}
                          </div>
                        </div>
                        {version.changelog && (
                          <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">{version.changelog}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500 dark:text-white/40">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDateTime(version.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {version.createdBy}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-neutral-500 dark:text-white/50" />
                Schema Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {previewVersion ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white">Version {previewVersion.version}</span>
                    {previewVersion.version === currentEndpoint?.currentSchemaVersion && <Badge severity="low">Current</Badge>}
                  </div>
                  <pre className={`${schemaPreviewClass} max-h-[520px] overflow-auto text-xs`}>
                    {JSON.stringify(previewVersion.schema, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-8 text-neutral-500 dark:text-white/40">
                  <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Select a version to preview</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Modal isOpen={showPreviewModal} onClose={() => setShowPreviewModal(false)} size="xl">
        <ModalHeader>
          <h2 className="text-xl font-semibold text-white">
            Schema v{previewVersion?.version}
          </h2>
        </ModalHeader>
        <ModalBody>
          <pre className={`${schemaPreviewClass} max-h-[70vh] overflow-auto text-sm`}>
            {previewVersion && JSON.stringify(previewVersion.schema, null, 2)}
          </pre>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
            Close
          </Button>
          {canUpdateSchema && (
            <Button
              leftIcon={<RotateCcw className="w-4 h-4" />}
              onClick={() => {
                if (previewVersion) void handleRollback(previewVersion.id);
              }}
              loading={isUpdating}
              disabled={previewVersion?.version === currentEndpoint?.currentSchemaVersion}
            >
              Rollback to this version
            </Button>
          )}
        </ModalFooter>
      </Modal>

      <Modal isOpen={showCompareModal} onClose={() => setShowCompareModal(false)} size="xl">
        <ModalHeader>
          <h2 className="text-xl font-semibold text-white">Compare Versions</h2>
        </ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-neutral-800 dark:text-white/80 mb-2">
                Version {compareVersions[0]?.version ?? selectedVersions[0]}
              </h3>
              <pre className={`${schemaPreviewClass} max-h-80 overflow-auto text-xs`}>
                {JSON.stringify(compareVersions[0]?.schema, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-medium text-neutral-800 dark:text-white/80 mb-2">
                Version {compareVersions[1]?.version ?? selectedVersions[1]}
              </h3>
              <pre className={`${schemaPreviewClass} max-h-80 overflow-auto text-xs`}>
                {JSON.stringify(compareVersions[1]?.schema, null, 2)}
              </pre>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowCompareModal(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </motion.div>
  );
}
