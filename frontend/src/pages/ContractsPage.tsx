import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, FileCode2, RefreshCw, UploadCloud } from 'lucide-react';
import { useProjectStore } from '@/store';
import { api } from '@/services/api';
import { getApiBaseUrl } from '@/services/runtimeConfig';
import { hasProjectPermission } from '@/utils/permissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Badge } from '@/components/common/Badge';

type ContractEndpoint = {
  method: string;
  path: string;
  operationId: string;
  summary: string;
  tags: string[];
  requestBody?: unknown;
  responseModel?: unknown;
  statusCode: string;
};

type ContractVersion = {
  version: number;
  uploadedAt: string;
  uploadedBy: string;
  endpointCount?: number;
  schemaCount?: number;
  endpoints?: ContractEndpoint[];
  schemas?: Record<string, unknown>;
};

type ApiContract = {
  id: string;
  projectId: string;
  contractName: string;
  sourceType: string;
  currentVersion: number;
  updatedAt: string;
  liveBaseUrl?: string;
  versions: ContractVersion[];
};

type DriftReport = {
  id: string;
  contractId: string;
  contractName: string;
  fromVersion: number;
  toVersion: number;
  driftedAt: string;
  severity: 'none' | 'low' | 'medium' | 'high' | 'breaking';
  summary: string;
  changes: {
    added: Array<Record<string, unknown>>;
    removed: Array<Record<string, unknown>>;
    modified: Array<{ method: string; path: string; operationId: string; changes: Array<Record<string, unknown>> }>;
    schemaChanges: Array<Record<string, unknown>>;
  };
};

const methodClasses: Record<string, string> = {
  GET: 'border-blue-400/30 bg-blue-500/15 text-blue-200',
  POST: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
  PUT: 'border-yellow-400/30 bg-yellow-500/15 text-yellow-200',
  PATCH: 'border-orange-400/30 bg-orange-500/15 text-orange-200',
  DELETE: 'border-red-400/30 bg-red-500/15 text-red-200',
};

const severityClasses: Record<string, string> = {
  high: 'border-red-400/40 bg-red-500/15 text-red-200',
  breaking: 'border-red-400/40 bg-red-500/15 text-red-200',
  medium: 'border-yellow-400/40 bg-yellow-500/15 text-yellow-100',
  low: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100',
  none: 'border-white/10 bg-white/5 text-white/60',
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message || fallback);
  }
  return fallback;
}

function detectType(file?: File | null) {
  if (!file) return '';
  const name = file.name.toLowerCase();
  if (name.endsWith('.py')) return 'FastAPI Python';
  if (name.endsWith('.yaml') || name.endsWith('.yml')) return 'OpenAPI YAML';
  if (name.includes('postman')) return 'Postman';
  return 'OpenAPI / Swagger JSON';
}

export default function ContractsPage() {
  const { currentProject, fetchCurrentProject } = useProjectStore();
  const [contracts, setContracts] = useState<ApiContract[]>([]);
  const [selectedContract, setSelectedContract] = useState<ApiContract | null>(null);
  const [driftReports, setDriftReports] = useState<DriftReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<DriftReport | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [contractName, setContractName] = useState('');
  const [liveBaseUrl, setLiveBaseUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const canUpload = hasProjectPermission(currentProject?.currentUserRole, 'contract:upload');
  const selectedVersion = useMemo(() => {
    if (!selectedContract?.versions.length) return undefined;
    return selectedContract.versions[selectedContract.versions.length - 1];
  }, [selectedContract]);

  const loadContracts = async () => {
    if (!currentProject?.id) return;
    setIsLoading(true);
    try {
      const items = await api.get<ApiContract[]>('/contracts', { projectId: currentProject.id });
      setContracts(items);
      if (selectedContract) {
        const refreshed = items.find((item) => item.id === selectedContract.id) || null;
        setSelectedContract(refreshed);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not load contracts.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentProject?.id) void fetchCurrentProject();
  }, [currentProject?.id, fetchCurrentProject]);

  useEffect(() => {
    void loadContracts();
  }, [currentProject?.id]);

  const loadContractDetails = async (contract: ApiContract) => {
    try {
      const [details, reports] = await Promise.all([
        api.get<ApiContract>(`/contracts/${contract.id}`),
        api.get<DriftReport[]>(`/contracts/${contract.id}/drift`),
      ]);
      setSelectedContract(details);
      setDriftReports(reports);
      setSelectedReport(reports[0] || null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not load contract details.'));
    }
  };

  const uploadContract = async () => {
    if (!currentProject?.id || !file) return;
    if (!canUpload) {
      toast.error('You do not have permission to upload contracts.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', currentProject.id);
    if (contractName.trim()) formData.append('contractName', contractName.trim());
    setIsUploading(true);
    try {
      const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
      const response = await fetch(`${getApiBaseUrl()}/contracts/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Upload failed.');
      toast.success(result.driftReport ? 'Contract uploaded and drift report generated.' : result.identical ? 'No changes detected.' : 'Contract baseline saved.');
      setFile(null);
      setContractName('');
      await loadContracts();
      await loadContractDetails(result.contract);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not upload contract.'));
    } finally {
      setIsUploading(false);
    }
  };

  const importLive = async () => {
    if (!currentProject?.id || !liveBaseUrl.trim()) return;
    setIsUploading(true);
    try {
      const result = await api.post<{ contract: ApiContract; driftReport?: DriftReport }>('/contracts/import-live', {
        projectId: currentProject.id,
        baseUrl: liveBaseUrl.trim(),
      });
      toast.success(result.driftReport ? 'Live OpenAPI refreshed with drift detected.' : 'Live OpenAPI imported.');
      await loadContracts();
      await loadContractDetails(result.contract);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not import live OpenAPI.'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Contracts</h1>
        <p className="text-white/60">Upload API definitions, version contracts, and review drift reports.</p>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]">
          <label className="flex min-h-[132px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/15 bg-white/5 px-4 text-center transition-colors hover:bg-white/10">
            <UploadCloud className="mb-3 h-8 w-8 text-sky-200" />
            <span className="text-sm font-semibold text-white">{file ? file.name : 'Drop or choose .py, .json, .yaml, .yml'}</span>
            <span className="mt-1 text-xs text-white/50">{file ? detectType(file) : 'FastAPI, OpenAPI, Swagger, or Postman collection'}</span>
            <input
              className="hidden"
              type="file"
              accept=".py,.json,.yaml,.yml"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>
          <div className="flex min-w-[280px] flex-col gap-3">
            <Input label="Contract name" value={contractName} onChange={(event) => setContractName(event.target.value)} placeholder={file?.name || 'Defaults to filename'} />
            <Button loading={isUploading} disabled={!file || !canUpload} onClick={() => void uploadContract()} leftIcon={<UploadCloud className="h-4 w-4" />}>
              Upload Contract
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 p-5 md:grid-cols-[1fr_auto]">
          <Input label="Live FastAPI base URL" value={liveBaseUrl} onChange={(event) => setLiveBaseUrl(event.target.value)} placeholder="https://my-api.onrender.com" />
          <Button className="self-end" variant="secondary" loading={isUploading} disabled={!canUpload} onClick={() => void importLive()} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Import / Refresh
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Contracts {isLoading ? '...' : ''}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contracts.map((contract) => (
              <button
                key={contract.id}
                type="button"
                onClick={() => void loadContractDetails(contract)}
                className="w-full rounded-lg border border-white/10 bg-white/5 p-4 text-left transition-colors hover:bg-white/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-white">{contract.contractName}</span>
                  <Badge>v{contract.currentVersion}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/50">
                  <Badge className="border-sky-400/25 bg-sky-500/10 text-sky-100">{contract.sourceType}</Badge>
                  <span>{new Date(contract.updatedAt).toLocaleString()}</span>
                </div>
              </button>
            ))}
            {!contracts.length && <p className="text-sm text-white/50">No contracts uploaded yet.</p>}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {selectedContract ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{selectedContract.contractName} Endpoints</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="text-xs uppercase text-white/40">
                      <tr>
                        <th className="pb-3">Method</th>
                        <th className="pb-3">Path</th>
                        <th className="pb-3">Operation</th>
                        <th className="pb-3">Tags</th>
                        <th className="pb-3">Request Body</th>
                        <th className="pb-3">Response</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {((selectedVersion?.endpoints || []) as ContractEndpoint[]).map((endpoint: ContractEndpoint) => (
                        <tr key={`${endpoint.method}:${endpoint.path}`} className="text-white/75">
                          <td className="py-3"><Badge className={methodClasses[endpoint.method] || ''}>{endpoint.method}</Badge></td>
                          <td className="py-3 font-mono text-xs">{endpoint.path}</td>
                          <td className="py-3">{endpoint.operationId}</td>
                          <td className="py-3">{endpoint.tags?.join(', ') || '-'}</td>
                          <td className="py-3">{endpoint.requestBody ? 'Yes' : '-'}</td>
                          <td className="py-3">{String(endpoint.responseModel || '-')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Drift Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {driftReports.map((report) => (
                    <button key={report.id} className="w-full rounded-lg border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10" onClick={() => setSelectedReport(report)}>
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge className={severityClasses[report.severity]}>{report.severity.toUpperCase()}</Badge>
                        <span className="font-semibold text-white">v{report.fromVersion} {'->'} v{report.toVersion}</span>
                        <span className="text-sm text-white/45">{new Date(report.driftedAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-2 text-sm text-white/65">{report.summary}</p>
                    </button>
                  ))}
                  {!driftReports.length && <p className="text-sm text-white/50">No drift reports yet. Re-upload a changed contract to generate one.</p>}
                </CardContent>
              </Card>

              {selectedReport && (
                <Card>
                  <CardHeader>
                    <CardTitle>Drift Report</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className={severityClasses[selectedReport.severity]}>{selectedReport.severity.toUpperCase()}</Badge>
                      <span className="text-white">v{selectedReport.fromVersion} {'->'} v{selectedReport.toVersion}</span>
                      <span className="text-white/50">{selectedReport.summary}</span>
                    </div>
                    <ReportSection title="Removed Endpoints" tone="red" items={selectedReport.changes.removed} />
                    <ReportSection title="Added Endpoints" tone="green" items={selectedReport.changes.added} />
                    <div className="space-y-3">
                      <h3 className="flex items-center gap-2 font-semibold text-yellow-100"><AlertTriangle className="h-4 w-4" /> Modified Endpoints</h3>
                      {selectedReport.changes.modified.map((endpoint) => (
                        <div key={`${endpoint.method}:${endpoint.path}`} className="rounded-lg border border-yellow-400/20 bg-yellow-500/10 p-4">
                          <div className="flex gap-2 text-white"><Badge className={methodClasses[endpoint.method]}>{endpoint.method}</Badge>{endpoint.path}</div>
                          <div className="mt-3 space-y-2">
                            {endpoint.changes.map((change, index) => (
                              <div key={index} className="rounded border border-white/10 bg-black/15 p-3 text-sm text-white/70">
                                <div>{String(change.location)} {change.field ? `- ${String(change.field)}` : ''}</div>
                                <div className="text-white/45">{String(change.impact || change.change)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <ReportSection title="Schema Changes" tone="blue" items={selectedReport.changes.schemaChanges} />
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center text-white/55">
                <FileCode2 className="mb-3 h-10 w-10 text-white/35" />
                Choose a contract to inspect endpoints and drift history.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportSection({ title, items, tone }: { title: string; items: Array<Record<string, unknown>>; tone: 'red' | 'green' | 'blue' }) {
  const toneClass = tone === 'red' ? 'border-red-400/20 bg-red-500/10 text-red-100' : tone === 'green' ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100' : 'border-sky-400/20 bg-sky-500/10 text-sky-100';
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-white">{title}</h3>
      {items.map((item, index) => (
        <div key={index} className={`rounded-lg border p-4 ${toneClass}`}>
          <div className="font-mono text-sm">{[item.method, item.path].filter(Boolean).join(' ') || `${item.model || ''}.${item.field || ''}`}</div>
          <div className="mt-1 text-sm opacity-80">{String(item.impact || item.summary || item.change || '')}</div>
        </div>
      ))}
      {!items.length && <p className="text-sm text-white/45">None.</p>}
    </div>
  );
}
