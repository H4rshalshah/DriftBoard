import { api } from './api';
import type { PaginationParams, PaginatedResponse } from './api';

export interface DriftEvent {
  id: string;
  projectId: string;
  endpointId: string;
  endpointName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'acknowledged' | 'resolved' | 'ignored';
  driftType: 'schema_addition' | 'schema_removal' | 'type_change' | 'constraint_change';
  description: string;
  previousSnapshotId: string;
  currentSnapshotId: string;
  changes: DriftChange[];
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DriftChange {
  path: string;
  field: string;
  changeType: 'added' | 'removed' | 'modified';
  previousValue?: unknown;
  currentValue?: unknown;
}

export interface DriftStats {
  totalEvents: number;
  unacknowledged: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byStatus: {
    pending: number;
    acknowledged: number;
    resolved: number;
    ignored: number;
  };
  trend: Array<{
    date: string;
    count: number;
  }>;
  topAffectedEndpoints: Array<{
    endpointId: string;
    endpointName: string;
    count: number;
  }>;
}

export interface Snapshot {
  id: string;
  endpointId: string;
  version: number;
  schema: Record<string, unknown>;
  capturedAt: string;
  triggeredBy: 'scheduled' | 'manual' | 'drift';
}

export interface SnapshotComparison {
  snapshot1: Snapshot;
  snapshot2: Snapshot;
  addedFields: string[];
  removedFields: string[];
  modifiedFields: Array<{
    path: string;
    previousType: string;
    currentType: string;
    previousConstraint?: unknown;
    currentConstraint?: unknown;
  }>;
}

export interface AcknowledgeDriftRequest {
  status?: 'acknowledged' | 'resolved' | 'ignored';
  comment?: string;
}

export interface DriftListParams extends PaginationParams {
  projectId: string;
  endpointId?: string;
  severity?: DriftEvent['severity'];
  status?: DriftEvent['status'];
  driftType?: DriftEvent['driftType'];
  startDate?: string;
  endDate?: string;
}

export interface DriftHistoryParams extends PaginationParams {
  endpointId: string;
}

export interface DriftService {
  getDriftEvents(projectId: string, params?: Omit<DriftListParams, 'projectId'>): Promise<PaginatedResponse<DriftEvent>>;
  getDriftEvent(id: string): Promise<DriftEvent>;
  acknowledgeDrift(id: string, data?: AcknowledgeDriftRequest): Promise<DriftEvent>;
  getDriftStats(projectId: string): Promise<DriftStats>;
  compareSnapshots(snapshot1Id: string, snapshot2Id: string): Promise<SnapshotComparison>;
  getDriftHistory(endpointId: string, params?: Omit<DriftHistoryParams, 'endpointId'>): Promise<DriftEvent[]>;
}

class DriftServiceImpl implements DriftService {
  private readonly baseUrl = '/drift';

  async getDriftEvents(
    projectId: string,
    params?: Omit<DriftListParams, 'projectId'>
  ): Promise<PaginatedResponse<DriftEvent>> {
    try {
      return await api.get<PaginatedResponse<DriftEvent>>(this.baseUrl, {
        projectId,
        ...params,
      } as Record<string, unknown>);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getDriftEvent(id: string): Promise<DriftEvent> {
    try {
      return await api.get<DriftEvent>(`${this.baseUrl}/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async acknowledgeDrift(id: string, data?: AcknowledgeDriftRequest): Promise<DriftEvent> {
    try {
      return await api.post<DriftEvent>(`${this.baseUrl}/${id}/acknowledge`, data || {});
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getDriftStats(projectId: string): Promise<DriftStats> {
    try {
      return await api.get<DriftStats>(`${this.baseUrl}/stats`, { projectId } as Record<string, unknown>);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async compareSnapshots(snapshot1Id: string, snapshot2Id: string): Promise<SnapshotComparison> {
    try {
      return await api.get<SnapshotComparison>(`${this.baseUrl}/compare`, {
        snapshot1Id,
        snapshot2Id,
      } as Record<string, unknown>);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getDriftHistory(
    endpointId: string,
    params?: Omit<DriftHistoryParams, 'endpointId'>
  ): Promise<DriftEvent[]> {
    try {
      return await api.get<DriftEvent[]>(`${this.baseUrl}/history`, {
        endpointId,
        ...params,
      } as Record<string, unknown>);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error('An unexpected error occurred while fetching drift events');
  }
}

export const driftService = new DriftServiceImpl();
export default driftService;
