 import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Edit, Key, Plus, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { api } from '@/services/api';
import { useProjectStore } from '@/store/projectStore';
import { hasProjectPermission } from '@/utils/permissions';

interface ApiKey {
  id: string;
  projectId: string;
  name: string;
  keyPrefix: string;
  fullKey?: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  status: 'active' | 'deprecated' | 'revoked';
}

export default function ApiKeysPage() {
  const { currentProject } = useProjectStore();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const canViewApiKeys = hasProjectPermission(currentProject?.currentUserRole, 'api_key:view');
  const canManageApiKeys = hasProjectPermission(currentProject?.currentUserRole, 'api_key:create');

  const activeCount = useMemo(() => keys.filter((item) => item.status === 'active').length, [keys]);

  useEffect(() => {
    const loadKeys = async () => {
      if (!currentProject?.id || !canViewApiKeys) return;
      setIsLoading(true);
      setError('');
      try {
        const response = await api.get<ApiKey[]>(`/projects/${currentProject.id}/api-keys`);
        setKeys(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load API keys');
      } finally {
        setIsLoading(false);
      }
    };
    void loadKeys();
  }, [canViewApiKeys, currentProject?.id]);

  const createKey = async () => {
    if (!currentProject?.id) {
      setError('Connect a live project before creating API keys.');
      return;
    }
    if (!canManageApiKeys) {
      setError('You do not have permission to perform this action.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const keyName = name.trim() || `Project key ${keys.length + 1}`;
      const nextKey = await api.post<ApiKey>(`/projects/${currentProject.id}/api-keys`, {
        name: keyName,
        scopes: ['read:schema', 'write:schema', 'read:events'],
      });
      setKeys((current) => [nextKey, ...current]);
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message?: unknown }).message) : 'Unable to generate API key');
    } finally {
      setIsSaving(false);
    }
  };

  const copyKey = async (apiKey: ApiKey) => {
    await navigator.clipboard?.writeText(apiKey.fullKey || apiKey.keyPrefix);
    setCopiedId(apiKey.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  const rotateKey = async (id: string) => {
    if (!canManageApiKeys) {
      setError('You do not have permission to perform this action.');
      return;
    }
    try {
      const rotated = await api.post<ApiKey>(`/api-keys/${id}/rotate`);
      setKeys((current) => current.map((item) => (item.id === id ? rotated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to rotate API key');
    }
  };

  const revokeKey = async (id: string) => {
    if (!canManageApiKeys) {
      setError('You do not have permission to perform this action.');
      return;
    }
    try {
      const revoked = await api.post<ApiKey>(`/api-keys/${id}/revoke`);
      setKeys((current) => current.map((item) => (item.id === id ? revoked : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to revoke API key');
    }
  };

  const deleteKey = async (id: string) => {
    if (!canManageApiKeys) {
      setError('You do not have permission to perform this action.');
      return;
    }
    if (!window.confirm('Delete this API key permanently?')) return;
    try {
      await api.delete(`/api-keys/${id}`);
      setKeys((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete API key');
    }
  };

  const startEdit = (apiKey: ApiKey) => {
    if (!canManageApiKeys) return;
    setEditingId(apiKey.id);
    setEditName(apiKey.name);
    setError('');
  };

  const saveEdit = async (apiKey: ApiKey) => {
    if (!canManageApiKeys) {
      setError('You do not have permission to perform this action.');
      return;
    }
    const nextName = editName.trim();
    if (!nextName) {
      setError('Key name is required.');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await api.patch<ApiKey>(`/api-keys/${apiKey.id}`, {
        name: nextName,
        scopes: apiKey.scopes,
      });
      setKeys((current) => current.map((item) => (item.id === apiKey.id ? updated : item)));
      setEditingId(null);
      setEditName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update API key');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary-300">Security</p>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">API Keys</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
            {currentProject ? `Create and manage keys for ${currentProject.name}.` : 'Connect a project before creating live API keys.'}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
          <Card className="px-5 py-4">
            <p className="text-sm text-white/50">Active keys</p>
            <p className="mt-1 text-2xl font-bold text-white">{activeCount}</p>
          </Card>
          <Card className="px-5 py-4">
            <p className="text-sm text-white/50">Protected scopes</p>
            <p className="mt-1 text-2xl font-bold text-white">5</p>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create key</CardTitle>
        </CardHeader>
        <CardContent>
          {!canViewApiKeys && (
            <p className="mb-3 text-sm text-white/50">You do not have permission to view or manage API keys for this project.</p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              label="Key name"
              placeholder="Production SDK"
              value={name}
              onChange={(event) => setName(event.target.value)}
              leftIcon={<Key className="h-4 w-4" />}
            />
            <Button className="w-full sm:min-w-[150px] sm:w-auto" leftIcon={<Plus className="h-4 w-4" />} onClick={createKey} loading={isSaving} disabled={!currentProject?.id || !canManageApiKeys}>
              Generate
            </Button>
          </div>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {isLoading && <p className="text-sm text-white/50">Loading API keys...</p>}
        {!isLoading && canViewApiKeys && keys.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-white/50">No API keys for this project yet.</CardContent>
          </Card>
        )}
        {keys.map((apiKey) => (
          <Card key={apiKey.id}>
            <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-primary-500/15 text-primary-200">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {editingId === apiKey.id ? (
                      <Input
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        className="h-9 min-w-[220px]"
                        aria-label="API key name"
                      />
                    ) : (
                      <h2 className="font-semibold text-white">{apiKey.name}</h2>
                    )}
                    <Badge variant="status" status={apiKey.status === 'revoked' ? 'inactive' : apiKey.status}>{apiKey.status}</Badge>
                  </div>
                  <p className="mt-1 break-all font-mono text-sm text-white/50">{apiKey.fullKey || apiKey.keyPrefix}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40">
                    <span>{apiKey.scopes.join(', ')}</span>
                    <span>Created {new Date(apiKey.createdAt).toLocaleString()}</span>
                    <span>Last used {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleString() : 'Never'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center lg:flex-nowrap">
                {editingId === apiKey.id ? (
                  <>
                    <Button className="w-full sm:w-auto" variant="secondary" size="sm" leftIcon={<Check className="h-4 w-4" />} loading={isSaving} onClick={() => saveEdit(apiKey)}>
                      Save
                    </Button>
                    <Button className="w-full sm:w-auto" variant="ghost" size="sm" leftIcon={<X className="h-4 w-4" />} onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </>
                ) : canManageApiKeys ? (
                  <Button className="w-full sm:w-auto" variant="secondary" size="sm" leftIcon={<Edit className="h-4 w-4" />} onClick={() => startEdit(apiKey)} disabled={apiKey.status === 'revoked'}>
                    Edit
                  </Button>
                ) : null}
                <Button className="w-full sm:w-auto" variant="secondary" size="sm" leftIcon={copiedId === apiKey.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} onClick={() => copyKey(apiKey)}>
                  {copiedId === apiKey.id ? 'Copied' : 'Copy'}
                </Button>
                {canManageApiKeys && (
                  <>
                    <Button className="w-full sm:w-auto" variant="secondary" size="sm" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={() => rotateKey(apiKey.id)} disabled={apiKey.status === 'revoked'}>
                      Rotate
                    </Button>
                    <Button className="w-full sm:w-auto" variant="secondary" size="sm" onClick={() => revokeKey(apiKey.id)} disabled={apiKey.status === 'revoked'}>
                      Revoke
                    </Button>
                    <Button className="w-full sm:w-auto" variant="danger" size="sm" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => deleteKey(apiKey.id)}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
