import { create } from 'zustand';
import { api } from '../services/api';

export type DriftSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DriftField {
  path: string;
  field: string;
  expected: unknown;
  actual: unknown;
}

export interface DriftEvent {
  id: string;
  endpointId: string;
  endpointName: string;
  projectId: string;
  projectName: string;
  severity: DriftSeverity;
  detectedAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  changes: DriftField[];
  message?: string;
}

export interface DriftStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  byEndpoint: Record<string, number>;
  byDay: Record<string, number>;
}

interface DriftFilters {
  severity: DriftSeverity[];
  endpointId: string | null;
  projectId: string | null;
  startDate: string | null;
  endDate: string | null;
  acknowledged: boolean | null;
  resolved: boolean | null;
}

interface DriftComparison {
  endpointId: string;
  versionA: string;
  versionB: string;
  changes: DriftField[];
}

interface DriftState {
  driftEvents: DriftEvent[];
  stats: DriftStats | null;
  comparison: DriftComparison | null;
  isLoading: boolean;
  isAcknowledging: boolean;
  isResolving: boolean;
  isComparing: boolean;
  error: string | null;
  filters: DriftFilters;

  fetchDriftEvents: (projectId?: string) => Promise<void>;
  fetchDriftStats: (projectId?: string) => Promise<void>;
  acknowledgeDrift: (id: string) => Promise<void>;
  resolveDrift: (id: string) => Promise<void>;
  setFilters: (filters: Partial<DriftFilters>) => void;
  clearFilters: () => void;
  startComparison: (endpointId: string, versionA: string, versionB: string) => Promise<void>;
  endComparison: () => void;
  clearError: () => void;
}

const defaultFilters: DriftFilters = {
  severity: [],
  endpointId: null,
  projectId: null,
  startDate: null,
  endDate: null,
  acknowledged: null,
  resolved: null,
};

export const useDriftStore = create<DriftState>((set, get) => ({
  driftEvents: [],
  stats: null,
  comparison: null,
  isLoading: false,
  isAcknowledging: false,
  isResolving: false,
  isComparing: false,
  error: null,
  filters: { ...defaultFilters },

  fetchDriftEvents: async (projectId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      const filters = get().filters;

      if (projectId) params.append('projectId', projectId);
      if (filters.severity.length) params.append('severity', filters.severity.join(','));
      if (filters.endpointId) params.append('endpointId', filters.endpointId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.acknowledged !== null) params.append('acknowledged', String(filters.acknowledged));
      if (filters.resolved !== null) params.append('resolved', String(filters.resolved));

      const events = await api.get<DriftEvent[]>(`/drift?${params.toString()}`);
      set({ driftEvents: events, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch drift events',
      });
    }
  },

  fetchDriftStats: async (projectId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const stats = await api.get<DriftStats>(
        projectId ? `/drift/stats?projectId=${projectId}` : '/drift/stats'
      );
      set({ stats, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch drift stats',
      });
    }
  },

  acknowledgeDrift: async (id: string) => {
    set({ isAcknowledging: true, error: null });
    const previousEvents = get().driftEvents;

    set((state) => ({
      driftEvents: state.driftEvents.map((e) =>
        e.id === id ? { ...e, acknowledgedAt: new Date().toISOString() } : e
      ),
    }));

    try {
      await api.post(`/drift/${id}/acknowledge`);
      set({ isAcknowledging: false });
    } catch (error) {
      set({ driftEvents: previousEvents, isAcknowledging: false });
      set({
        error: error instanceof Error ? error.message : 'Failed to acknowledge drift',
      });
      throw error;
    }
  },

  resolveDrift: async (id: string) => {
    set({ isResolving: true, error: null });
    const previousEvents = get().driftEvents;

    set((state) => ({
      driftEvents: state.driftEvents.map((e) =>
        e.id === id ? { ...e, resolvedAt: new Date().toISOString() } : e
      ),
    }));

    try {
      await api.post(`/drift/${id}/resolve`);
      set({ isResolving: false });
    } catch (error) {
      set({ driftEvents: previousEvents, isResolving: false });
      set({
        error: error instanceof Error ? error.message : 'Failed to resolve drift',
      });
      throw error;
    }
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  clearFilters: () => {
    set({ filters: { ...defaultFilters } });
  },

  startComparison: async (endpointId, versionA, versionB) => {
    set({ isComparing: true, error: null });
    try {
      const comparison = await api.get<DriftComparison>(
        `/endpoints/${endpointId}/compare?versionA=${versionA}&versionB=${versionB}`
      );
      set({ comparison, isComparing: false });
    } catch (error) {
      set({
        isComparing: false,
        error: error instanceof Error ? error.message : 'Failed to compare versions',
      });
      throw error;
    }
  },

  endComparison: () => {
    set({ comparison: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));

export const selectFilteredDriftEvents = (state: DriftState): DriftEvent[] => {
  const { driftEvents, filters } = state;
  return driftEvents.filter((event) => {
    if (filters.acknowledged !== null) {
      const isAcknowledged = event.acknowledgedAt !== undefined;
      if (filters.acknowledged !== isAcknowledged) return false;
    }
    if (filters.resolved !== null) {
      const isResolved = event.resolvedAt !== undefined;
      if (filters.resolved !== isResolved) return false;
    }
    return true;
  });
};

export const selectCriticalCount = (state: DriftState) =>
  state.driftEvents.filter((e) => e.severity === 'critical' && !e.resolvedAt).length;