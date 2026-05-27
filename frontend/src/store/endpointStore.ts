import { create } from 'zustand';
import { api } from '../services/api';
import { useDriftStore, type DriftEvent } from './driftStore';

export interface SchemaVersion {
  id: string;
  endpointId: string;
  version: number;
  schema: Record<string, unknown>;
  createdAt: string;
  createdBy: string;
  changelog?: string;
}

export interface Endpoint {
  id: string;
  projectId: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  status?: 'healthy' | 'warning' | 'drifted' | 'failed' | 'disabled';
  health?: number;
  responseTime?: number;
  monitoringEnabled?: boolean;
  frequency?: string;
  currentSchema: Record<string, unknown>;
  currentSchemaVersion: number;
  schemaVersions: SchemaVersion[];
  createdAt: string;
  updatedAt: string;
  lastCheckedAt?: string;
  lastDriftAt?: string;
}

interface EndpointState {
  endpoints: Endpoint[];
  activeEndpoint: Endpoint | null;
  schemaHistory: SchemaVersion[];
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: string | null;
  selectedProjectId: string | null;

  fetchEndpoints: (projectId: string) => Promise<void>;
  fetchEndpoint: (id: string) => Promise<void>;
  fetchSchemaHistory: (endpointId: string) => Promise<void>;
  createEndpoint: (projectId: string, data: Partial<Omit<Endpoint, 'id' | 'projectId' | 'schemaVersions' | 'createdAt' | 'updatedAt'>> & Pick<Endpoint, 'name' | 'url' | 'method'>) => Promise<Endpoint>;
  updateEndpoint: (id: string, data: Partial<Omit<Endpoint, 'id' | 'projectId' | 'schemaVersions' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteEndpoint: (id: string) => Promise<void>;
  refreshEndpoint: (id: string) => Promise<{ endpoint: Endpoint; changed?: boolean; failure?: boolean; event?: DriftEvent; notification?: unknown }>;
  setActiveEndpoint: (endpoint: Endpoint | null) => void;
  setSelectedProjectId: (id: string | null) => void;
  rollbackSchema: (endpointId: string, versionId: string) => Promise<void>;
  clearError: () => void;
}

export const useEndpointStore = create<EndpointState>((set, get) => ({
  endpoints: [],
  activeEndpoint: null,
  schemaHistory: [],
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
  selectedProjectId: null,

  fetchEndpoints: async (projectId: string) => {
    set({ isLoading: true, error: null, selectedProjectId: projectId });
    try {
      const endpoints = await api.get<Endpoint[]>(`/projects/${projectId}/endpoints`);
      set({ endpoints, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch endpoints',
      });
    }
  },

  fetchEndpoint: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const endpoint = await api.get<Endpoint>(`/endpoints/${id}`);
      set({ activeEndpoint: endpoint, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch endpoint',
      });
    }
  },

  fetchSchemaHistory: async (endpointId: string) => {
    set({ isLoading: true, error: null });
    try {
      const history = await api.get<SchemaVersion[]>(`/endpoints/${endpointId}/schema-history`);
      set({ schemaHistory: history, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch schema history',
      });
    }
  },

  createEndpoint: async (projectId, data) => {
    set({ isCreating: true, error: null });
    try {
      const endpoint = await api.post<Endpoint>(`/projects/${projectId}/endpoints`, data);
      set((state) => ({
        endpoints: [...state.endpoints, endpoint],
        isCreating: false,
      }));
      return endpoint;
    } catch (error) {
      set({
        isCreating: false,
        error: error instanceof Error ? error.message : 'Failed to create endpoint',
      });
      throw error;
    }
  },

  updateEndpoint: async (id, data) => {
    set({ isUpdating: true, error: null });
    const previousEndpoints = get().endpoints;

    set((state) => ({
      endpoints: state.endpoints.map((e) =>
        e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e
      ),
    }));

    try {
      const endpoint = await api.patch<Endpoint>(`/endpoints/${id}`, data);
      set((state) => ({
        endpoints: state.endpoints.map((item) => (item.id === id ? endpoint : item)),
        activeEndpoint: state.activeEndpoint?.id === id ? endpoint : state.activeEndpoint,
        schemaHistory: state.schemaHistory.some((version) => version.endpointId === id) ? endpoint.schemaVersions : state.schemaHistory,
        isUpdating: false,
      }));
    } catch (error) {
      set({ endpoints: previousEndpoints, isUpdating: false });
      set({
        error: error instanceof Error ? error.message : 'Failed to update endpoint',
      });
      throw error;
    }
  },

  deleteEndpoint: async (id: string) => {
    set({ isDeleting: true, error: null });
    const previousEndpoints = get().endpoints;

    set((state) => ({
      endpoints: state.endpoints.filter((e) => e.id !== id),
      activeEndpoint: state.activeEndpoint?.id === id ? null : state.activeEndpoint,
    }));

    try {
      await api.delete(`/endpoints/${id}`);
      set({ isDeleting: false });
    } catch (error) {
      set({ endpoints: previousEndpoints, isDeleting: false });
      set({
        error: error instanceof Error ? error.message : 'Failed to delete endpoint',
      });
      throw error;
    }
  },

  refreshEndpoint: async (id: string) => {
    set({ isUpdating: true, error: null });
    try {
      const result = await api.post<{ endpoint: Endpoint; changed?: boolean; failure?: boolean; event?: DriftEvent; notification?: unknown }>(`/endpoints/${id}/refresh`);
      const refreshedEndpoint = result.endpoint;
      set((state) => ({
        endpoints: state.endpoints.map((endpoint) => (endpoint.id === id ? refreshedEndpoint : endpoint)),
        activeEndpoint: state.activeEndpoint?.id === id ? refreshedEndpoint : state.activeEndpoint,
        schemaHistory: state.schemaHistory.some((version) => version.endpointId === id) ? refreshedEndpoint.schemaVersions : state.schemaHistory,
        isUpdating: false,
      }));
      if (result.event) {
        useDriftStore.setState((state) => ({
          driftEvents: state.driftEvents.some((event) => event.id === result.event?.id)
            ? state.driftEvents
            : [result.event!, ...state.driftEvents],
        }));
      }
      return result;
    } catch (error) {
      set({
        isUpdating: false,
        error: error instanceof Error ? error.message : 'Failed to refresh endpoint',
      });
      throw error;
    }
  },

  setActiveEndpoint: (endpoint) => {
    set({ activeEndpoint: endpoint });
  },

  setSelectedProjectId: (id) => {
    set({ selectedProjectId: id });
  },

  rollbackSchema: async (endpointId, versionId) => {
    set({ isUpdating: true, error: null });
    try {
      const endpoint = await api.post<Endpoint>(`/endpoints/${endpointId}/rollback`, { versionId });
      set((state) => ({
        endpoints: state.endpoints.map((e) => (e.id === endpointId ? endpoint : e)),
        activeEndpoint: state.activeEndpoint?.id === endpointId ? endpoint : state.activeEndpoint,
        schemaHistory: endpoint.schemaVersions,
        isUpdating: false,
      }));
    } catch (error) {
      set({
        isUpdating: false,
        error: error instanceof Error ? error.message : 'Failed to rollback schema',
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

export const selectEndpointsByProject = (state: EndpointState, projectId: string) =>
  state.endpoints.filter((e) => e.projectId === projectId);
export const selectActiveEndpoint = (state: EndpointState) => state.activeEndpoint;
