/**
 * Schema Snapshot Service for DriftBoard
 * Manages schema snapshots for version comparison and rollback
 */

import { detectSchemaDrift } from './driftDetection';
import { normalizeSchema, getFieldPaths } from './schemaParser';

export interface SchemaSnapshot {
  id: string;
  endpointId: string;
  schema: any;
  normalizedSchema: any;
  fieldPaths: string[];
  createdAt: Date;
  checksum: string;
  metadata?: SnapshotMetadata;
}

export interface SnapshotMetadata {
  source?: 'manual' | 'automatic' | 'import';
  triggeredBy?: string;
  environment?: string;
  version?: string;
  labels?: string[];
}

export interface SchemaComparison {
  hasDrift: boolean;
  severity: 'low' | 'medium' | 'breaking';
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

export interface SnapshotFilter {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

interface SnapshotStorage {
  save(snapshot: SchemaSnapshot): Promise<void>;
  findByEndpoint(endpointId: string, filter?: SnapshotFilter): Promise<SchemaSnapshot[]>;
  findById(id: string): Promise<SchemaSnapshot | null>;
  delete(id: string): Promise<boolean>;
  deleteByEndpoint(endpointId: string): Promise<number>;
  getStats(endpointId: string): Promise<SnapshotStats>;
}

const inMemorySnapshotStorage: SnapshotStorage = {
  snapshots: new Map<string, SchemaSnapshot[]>(),

  async save(snapshot: SchemaSnapshot): Promise<void> {
    const existing = this.snapshots.get(snapshot.endpointId) || [];
    existing.push(snapshot);
    this.snapshots.set(snapshot.endpointId, existing);
  },

  async findByEndpoint(endpointId: string, filter?: SnapshotFilter): Promise<SchemaSnapshot[]> {
    let snapshots = this.snapshots.get(endpointId) || [];
    
    if (filter) {
      if (filter.startDate) {
        snapshots = snapshots.filter(s => new Date(s.createdAt) >= filter.startDate!);
      }
      if (filter.endDate) {
        snapshots = snapshots.filter(s => new Date(s.createdAt) <= filter.endDate!);
      }
    }

    snapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filter) {
      const offset = filter.offset || 0;
      const limit = filter.limit || snapshots.length;
      return snapshots.slice(offset, offset + limit);
    }

    return snapshots;
  },

  async findById(id: string): Promise<SchemaSnapshot | null> {
    for (const snapshots of this.snapshots.values()) {
      const found = snapshots.find(s => s.id === id);
      if (found) return found;
    }
    return null;
  },

  async delete(id: string): Promise<boolean> {
    for (const [endpointId, snapshots] of this.snapshots.entries()) {
      const index = snapshots.findIndex(s => s.id === id);
      if (index !== -1) {
        snapshots.splice(index, 1);
        return true;
      }
    }
    return false;
  },

  async deleteByEndpoint(endpointId: string): Promise<number> {
    const count = (this.snapshots.get(endpointId) || []).length;
    this.snapshots.delete(endpointId);
    return count;
  },

  async getStats(endpointId: string): Promise<SnapshotStats> {
    const snapshots = this.snapshots.get(endpointId) || [];
    const checksums = new Set(snapshots.map(s => s.checksum));
    
    return {
      totalSnapshots: snapshots.length,
      uniqueSchemas: checksums.size,
      firstSnapshot: snapshots.length > 0 ? snapshots[snapshots.length - 1].createdAt : null,
      latestSnapshot: snapshots.length > 0 ? snapshots[0].createdAt : null,
    };
  },
};

interface SnapshotStats {
  totalSnapshots: number;
  uniqueSchemas: number;
  firstSnapshot: Date | null;
  latestSnapshot: Date | null;
}

let storage: SnapshotStorage = inMemorySnapshotStorage;

export function initializeStorage(adapter: SnapshotStorage): void {
  storage = adapter;
}

function generateSnapshotId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `snap_${timestamp}_${random}`;
}

function computeChecksum(schema: any): string {
  const normalized = normalizeSchema(schema);
  const str = JSON.stringify(normalized);
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
}

export async function createSnapshot(
  endpointId: string,
  schema: object,
  metadata?: SnapshotMetadata
): Promise<SchemaSnapshot> {
  const normalized = normalizeSchema(schema);
  
  const snapshot: SchemaSnapshot = {
    id: generateSnapshotId(),
    endpointId,
    schema,
    normalizedSchema: normalized,
    fieldPaths: getFieldPaths(schema),
    createdAt: new Date(),
    checksum: computeChecksum(schema),
    metadata,
  };

  await storage.save(snapshot);
  
  return snapshot;
}

export async function getLatestSnapshot(
  endpointId: string
): Promise<SchemaSnapshot | null> {
  const snapshots = await storage.findByEndpoint(endpointId, { limit: 1 });
  return snapshots.length > 0 ? snapshots[0] : null;
}

export async function getSnapshotHistory(
  endpointId: string,
  limit?: number
): Promise<SchemaSnapshot[]> {
  return storage.findByEndpoint(endpointId, { limit });
}

export async function getSnapshotsInRange(
  endpointId: string,
  startDate: Date,
  endDate: Date
): Promise<SchemaSnapshot[]> {
  return storage.findByEndpoint(endpointId, { startDate, endDate });
}

export async function compareSnapshots(
  snapshotId1: string,
  snapshotId2: string
): Promise<SchemaComparison> {
  const snapshot1 = await storage.findById(snapshotId1);
  const snapshot2 = await storage.findById(snapshotId2);

  if (!snapshot1) {
    throw new Error(`Snapshot not found: ${snapshotId1}`);
  }

  if (!snapshot2) {
    throw new Error(`Snapshot not found: ${snapshotId2}`);
  }

  if (snapshot1.endpointId !== snapshot2.endpointId) {
    throw new Error('Cannot compare snapshots from different endpoints');
  }

  return detectSchemaDrift(snapshot1.normalizedSchema, snapshot2.normalizedSchema);
}

export async function getSnapshotById(
  snapshotId: string
): Promise<SchemaSnapshot | null> {
  return storage.findById(snapshotId);
}

export async function deleteSnapshot(snapshotId: string): Promise<boolean> {
  return storage.delete(snapshotId);
}

export async function deleteSnapshotsByEndpoint(
  endpointId: string
): Promise<number> {
  return storage.deleteByEndpoint(endpointId);
}

export async function getSnapshotStats(
  endpointId: string
): Promise<SnapshotStats> {
  return storage.getStats(endpointId);
}

export async function findIdenticalSnapshots(
  endpointId: string,
  targetChecksum: string
): Promise<SchemaSnapshot[]> {
  const snapshots = await storage.findByEndpoint(endpointId);
  return snapshots.filter(s => s.checksum === targetChecksum);
}

export async function getSchemaVersionTimeline(
  endpointId: string
): Promise<{ timestamp: Date; checksum: string; version: number }[]> {
  const snapshots = await storage.findByEndpoint(endpointId);
  
  const timeline: { timestamp: Date; checksum: string; version: number }[] = [];
  let version = 1;

  for (const snapshot of snapshots.reverse()) {
    timeline.push({
      timestamp: snapshot.createdAt,
      checksum: snapshot.checksum,
      version: version++,
    });
  }

  return timeline;
}

export async function pruneSnapshots(
  endpointId: string,
  keepCount: number
): Promise<number> {
  const snapshots = await storage.findByEndpoint(endpointId);
  
  if (snapshots.length <= keepCount) {
    return 0;
  }

  const toDelete = snapshots.slice(keepCount);
  let deleted = 0;

  for (const snapshot of toDelete) {
    const success = await storage.delete(snapshot.id);
    if (success) deleted++;
  }

  return deleted;
}

export async function cloneSnapshot(
  sourceSnapshotId: string,
  targetEndpointId: string
): Promise<SchemaSnapshot> {
  const source = await storage.findById(sourceSnapshotId);
  
  if (!source) {
    throw new Error(`Source snapshot not found: ${sourceSnapshotId}`);
  }

  return createSnapshot(targetEndpointId, source.schema, {
    source: 'clone',
    triggeredBy: source.metadata?.triggeredBy,
  });
}

export default {
  createSnapshot,
  getLatestSnapshot,
  getSnapshotHistory,
  getSnapshotsInRange,
  compareSnapshots,
  getSnapshotById,
  deleteSnapshot,
  deleteSnapshotsByEndpoint,
  getSnapshotStats,
  findIdenticalSnapshots,
  getSchemaVersionTimeline,
  pruneSnapshots,
  cloneSnapshot,
  initializeStorage,
};