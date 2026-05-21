/**
 * Main Drift Service for DriftBoard
 * Orchestrates drift detection, persistence, and real-time notifications
 */

import { detectSchemaDrift, Severity, describeChange } from './driftDetection';
import { extractSchema, normalizeSchema, getFieldPaths } from './schemaParser';

export interface SchemaComparison {
  hasDrift: boolean;
  severity: Severity;
  score: number;
  changes: any[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    renamed: number;
  };
  timestamp: Date;
}

export interface DriftEvent {
  driftId: string;
  endpointId: string;
  projectId: string;
  endpoint: string;
  method: string;
  comparison: SchemaComparison;
  snapshotId: string;
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface DriftStats {
  projectId: string;
  totalEndpoints: number;
  endpointsWithDrift: number;
  totalChanges: number;
  breakingChanges: number;
  mediumChanges: number;
  lowChanges: number;
  lastChecked: Date;
}

export interface Endpoint {
  id: string;
  projectId: string;
  path: string;
  method: string;
  schema: any;
  lastUpdated: Date;
}

export interface SchemaSnapshot {
  id: string;
  endpointId: string;
  schema: any;
  normalizedSchema: any;
  fieldPaths: string[];
  createdAt: Date;
  checksum: string;
}

interface StorageAdapter {
  saveSnapshot(snapshot: SchemaSnapshot): Promise<void>;
  getSnapshots(endpointId: string, limit?: number): Promise<SchemaSnapshot[]>;
  saveDriftEvent(event: DriftEvent): Promise<void>;
  getDriftEvents(endpointId: string, limit?: number): Promise<DriftEvent[]>;
  updateDriftAcknowledgment(driftId: string, userId: string): Promise<void>;
  getProjectEndpoints(projectId: string): Promise<Endpoint[]>;
  getProjectDriftEvents(projectId: string): Promise<DriftEvent[]>;
}

const inMemoryStorage: StorageAdapter = {
  snapshots: new Map<string, SchemaSnapshot[]>(),
  driftEvents: new Map<string, DriftEvent[]>(),
  endpoints: new Map<string, Endpoint>(),
  projects: new Map<string, string[]>(),

  async saveSnapshot(snapshot: SchemaSnapshot): Promise<void> {
    const existing = this.snapshots.get(snapshot.endpointId) || [];
    existing.push(snapshot);
    this.snapshots.set(snapshot.endpointId, existing);

    const endpoint = this.endpoints.get(snapshot.endpointId);
    if (endpoint) {
      endpoint.schema = snapshot.schema;
      endpoint.lastUpdated = snapshot.createdAt;
    }
  },

  async getSnapshots(endpointId: string, limit?: number): Promise<SchemaSnapshot[]> {
    const snapshots = this.snapshots.get(endpointId) || [];
    const sorted = snapshots.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  },

  async saveDriftEvent(event: DriftEvent): Promise<void> {
    const existing = this.driftEvents.get(event.endpointId) || [];
    existing.push(event as any);
    this.driftEvents.set(event.endpointId, existing);
  },

  async getDriftEvents(endpointId: string, limit?: number): Promise<DriftEvent[]> {
    const events = this.driftEvents.get(endpointId) || [];
    const sorted = events.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  },

  async updateDriftAcknowledgment(driftId: string, userId: string): Promise<void> {
    for (const events of this.driftEvents.values()) {
      const event = events.find(e => (e as any).driftId === driftId);
      if (event) {
        (event as any).acknowledged = true;
        (event as any).acknowledgedBy = userId;
        (event as any).acknowledgedAt = new Date();
        break;
      }
    }
  },

  async getProjectEndpoints(projectId: string): Promise<Endpoint[]> {
    return Array.from(this.endpoints.values()).filter(e => e.projectId === projectId);
  },

  async getProjectDriftEvents(projectId: string): Promise<DriftEvent[]> {
    const allEvents: DriftEvent[] = [];
    for (const events of this.driftEvents.values()) {
      for (const event of events) {
        if ((event as any).projectId === projectId) {
          allEvents.push(event);
        }
      }
    }
    return allEvents.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  registerEndpoint(endpoint: Endpoint): void {
    this.endpoints.set(endpoint.id, endpoint);
    const projectEndpoints = this.projects.get(endpoint.projectId) || [];
    if (!projectEndpoints.includes(endpoint.id)) {
      projectEndpoints.push(endpoint.id);
      this.projects.set(endpoint.projectId, projectEndpoints);
    }
  },
};

let storage: StorageAdapter = inMemoryStorage;

export function initializeStorage(adapter: StorageAdapter): void {
  storage = adapter;
}

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}_${random}`;
}

function computeChecksum(schema: any): string {
  const str = JSON.stringify(schema);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export async function detectDrift(
  endpointId: string,
  newSchema: object
): Promise<{ success: boolean; driftEvent?: DriftEvent; previousSchema?: any; error?: string }> {
  try {
    const endpoints = await storage.getProjectEndpoints('').then(() => 
      Array.from((inMemoryStorage as any).endpoints.values())
    );
    const endpoint = endpoints.find((e: Endpoint) => e.id === endpointId);

    if (!endpoint) {
      return { success: false, error: 'Endpoint not found' };
    }

    const previousSnapshots = await storage.getSnapshots(endpointId, 1);
    const previousSchema = previousSnapshots.length > 0 ? previousSnapshots[0].schema : null;

    const normalizedNew = normalizeSchema(newSchema);
    const normalizedPrevious = previousSchema ? normalizeSchema(previousSchema) : null;

    let comparison: SchemaComparison;

    if (!normalizedPrevious) {
      comparison = {
        hasDrift: false,
        severity: 'low',
        score: 0,
        changes: [],
        summary: { added: 0, removed: 0, modified: 0, renamed: 0 },
        timestamp: new Date(),
      };
    } else {
      comparison = detectSchemaDrift(normalizedPrevious, normalizedNew);
    }

    const snapshot: SchemaSnapshot = {
      id: generateId('snap'),
      endpointId,
      schema: newSchema,
      normalizedSchema: normalizedNew,
      fieldPaths: getFieldPaths(newSchema),
      createdAt: new Date(),
      checksum: computeChecksum(newSchema),
    };

    await storage.saveSnapshot(snapshot);

    let driftEvent: DriftEvent | undefined;

    if (comparison.hasDrift) {
      driftEvent = {
        driftId: generateId('drift'),
        endpointId,
        projectId: endpoint.projectId,
        endpoint: endpoint.path,
        method: endpoint.method,
        comparison,
        snapshotId: snapshot.id,
        createdAt: new Date(),
        acknowledged: false,
      };

      await storage.saveDriftEvent(driftEvent);
    }

    return {
      success: true,
      driftEvent,
      previousSchema: previousSchema || undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Drift detection failed for endpoint ${endpointId}:`, message);
    return { success: false, error: message };
  }
}

export async function getDriftHistory(
  endpointId: string,
  limit: number = 50
): Promise<DriftEvent[]> {
  try {
    return await storage.getDriftEvents(endpointId, limit);
  } catch (error) {
    console.error(`Failed to get drift history for ${endpointId}:`, error);
    return [];
  }
}

export async function acknowledgeDrift(
  driftId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await storage.updateDriftAcknowledgment(driftId, userId);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to acknowledge drift ${driftId}:`, message);
    return { success: false, error: message };
  }
}

export async function getDriftStats(
  projectId: string
): Promise<{ success: boolean; stats?: DriftStats; error?: string }> {
  try {
    const endpoints = await storage.getProjectEndpoints(projectId);
    const driftEvents = await storage.getProjectDriftEvents(projectId);

    const endpointsWithDrift = new Set<string>();
    let breakingChanges = 0;
    let mediumChanges = 0;
    let lowChanges = 0;
    let totalChanges = 0;

    for (const event of driftEvents) {
      endpointsWithDrift.add(event.endpointId);
      
      for (const change of event.comparison.changes) {
        totalChanges++;
        if (event.comparison.severity === 'breaking') {
          breakingChanges++;
        } else if (event.comparison.severity === 'medium') {
          mediumChanges++;
        } else {
          lowChanges++;
        }
      }
    }

    const stats: DriftStats = {
      projectId,
      totalEndpoints: endpoints.length,
      endpointsWithDrift: endpointsWithDrift.size,
      totalChanges,
      breakingChanges,
      mediumChanges,
      lowChanges,
      lastChecked: new Date(),
    };

    return { success: true, stats };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to get drift stats for ${projectId}:`, message);
    return { success: false, error: message };
  }
}

export async function registerEndpoint(
  projectId: string,
  path: string,
  method: string,
  initialSchema?: object
): Promise<{ success: boolean; endpoint?: Endpoint; error?: string }> {
  try {
    const endpoint: Endpoint = {
      id: generateId('ep'),
      projectId,
      path,
      method,
      schema: initialSchema || {},
      lastUpdated: new Date(),
    };

    (inMemoryStorage as any).registerEndpoint(endpoint);

    if (initialSchema) {
      await detectDrift(endpoint.id, initialSchema);
    }

    return { success: true, endpoint };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

export async function getLatestSchema(endpointId: string): Promise<any | null> {
  try {
    const snapshots = await storage.getSnapshots(endpointId, 1);
    return snapshots.length > 0 ? snapshots[0].schema : null;
  } catch (error) {
    console.error(`Failed to get latest schema for ${endpointId}:`, error);
    return null;
  }
}

export async function forceComparison(
  endpointId: string,
  schema1: object,
  schema2: object
): Promise<SchemaComparison> {
  const normalized1 = normalizeSchema(schema1);
  const normalized2 = normalizeSchema(schema2);
  return detectSchemaDrift(normalized1, normalized2);
}

export default {
  detectDrift,
  getDriftHistory,
  acknowledgeDrift,
  getDriftStats,
  registerEndpoint,
  getLatestSchema,
  forceComparison,
  initializeStorage,
};