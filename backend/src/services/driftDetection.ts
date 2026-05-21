/**
 * Drift Detection Engine for DriftBoard
 * Core algorithm for comparing JSON schemas and detecting API contract changes
 */

import { compareObjects, compareArrays, SchemaComparison, Change, ChangeType } from './driftDetection';
import { simplifySchema, normalizeSchema } from './schemaParser';

/**
 * Severity levels for detected changes
 */
export type Severity = 'low' | 'medium' | 'breaking';

/**
 * Detailed drift detection result
 */
export interface DriftResult {
  driftId: string;
  endpointId: string;
  comparison: SchemaComparison;
  previousSnapshotId: string | null;
  newSnapshotId: string | null;
  detectedAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

/**
 * Statistics for drift across a project
 */
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

/**
 * Normalize schema for comparison by sorting keys
 * @param schema - Schema to normalize
 * @returns Normalized schema object
 */
export function normalizeForComparison(schema: object): object {
  return normalizeSchema(schema);
}

/**
 * Calculate severity score based on change types
 * @param changes - Array of detected changes
 * @returns Severity level and numeric score (0-100)
 */
export function calculateSeverity(changes: Change[]): { severity: Severity; score: number } {
  let breakingScore = 0;
  let mediumScore = 0;
  let lowScore = 0;

  for (const change of changes) {
    switch (change.type) {
      case 'REMOVED':
        breakingScore += 15;
        break;
      case 'TYPE_CHANGED':
        breakingScore += 12;
        break;
      case 'NESTED_CHANGED':
        breakingScore += 8;
        mediumScore += 5;
        break;
      case 'MODIFIED':
        mediumScore += 8;
        break;
      case 'RENAMED':
        mediumScore += 5;
        break;
      case 'ADDED':
        lowScore += 2;
        break;
    }

    if (change.critical) {
      breakingScore += 10;
    }
  }

  const totalScore = Math.min(100, breakingScore + mediumScore * 0.6 + lowScore * 0.2);

  let severity: Severity;
  if (breakingScore >= 15 || totalScore >= 70) {
    severity = 'breaking';
  } else if (mediumScore >= 10 || totalScore >= 30) {
    severity = 'medium';
  } else {
    severity = 'low';
  }

  return { severity, score: Math.round(totalScore) };
}

/**
 * Detect drift between two schema versions
 * @param oldSchema - Previous schema version
 * @param newSchema - New schema version
 * @returns Detailed schema comparison result
 */
export function detectSchemaDrift(oldSchema: object, newSchema: object): SchemaComparison {
  const normalizedOld = normalizeForComparison(oldSchema);
  const normalizedNew = normalizeForComparison(newSchema);

  const changes = compareObjects(normalizedOld, normalizedNew, '');

  const { severity, score } = calculateSeverity(changes);

  const summary = {
    added: changes.filter(c => c.type === 'ADDED').length,
    removed: changes.filter(c => c.type === 'REMOVED').length,
    modified: changes.filter(c => c.type === 'MODIFIED').length,
    renamed: changes.filter(c => c.type === 'RENAMED').length,
  };

  return {
    hasDrift: changes.length > 0,
    severity,
    score,
    changes,
    summary,
    timestamp: new Date(),
  };
}

/**
 * Generate a unique drift ID
 * @param endpointId - Endpoint identifier
 * @returns Unique drift identifier
 */
export function generateDriftId(endpointId: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `drift_${endpointId}_${timestamp}_${random}`;
}

/**
 * Filter critical changes (breaking changes only)
 * @param changes - Array of all changes
 * @returns Filtered critical changes
 */
export function getCriticalChanges(changes: Change[]): Change[] {
  return changes.filter(c => 
    c.type === 'REMOVED' || 
    c.type === 'TYPE_CHANGED' ||
    c.critical
  );
}

/**
 * Group changes by path prefix
 * @param changes - Array of changes
 * @returns Map of path prefixes to changes
 */
export function groupChangesByPath(changes: Change[]): Map<string, Change[]> {
  const groups = new Map<string, Change[]>();

  for (const change of changes) {
    const parts = change.path.split('.');
    const prefix = parts.length > 1 ? parts.slice(0, -1).join('.') : 'root';
    
    const existing = groups.get(prefix) || [];
    existing.push(change);
    groups.set(prefix, existing);
  }

  return groups;
}

/**
 * Get human-readable description for a change
 * @param change - Change object
 * @returns Human-readable description
 */
export function describeChange(change: Change): string {
  const pathStr = change.path ? ` at '${change.path}'` : '';
  
  switch (change.type) {
    case 'ADDED':
      return `Added new field${pathStr}`;
    case 'REMOVED':
      return `Removed field${pathStr}`;
    case 'MODIFIED':
      return `Modified value${pathStr}`;
    case 'RENAMED':
      return `Renamed field from '${change.oldValue}' to '${change.newValue}'${pathStr.replace(/\.[^.]+$/, '')}`;
    case 'TYPE_CHANGED':
      return `Changed type from '${change.oldValue}' to '${change.newValue}'${pathStr}`;
    case 'NESTED_CHANGED':
      return `Nested structure changed${pathStr}`;
    default:
      return `Changed${pathStr}`;
  }
}

/**
 * Export the drift detection module
 */
export const driftDetection = {
  detectSchemaDrift,
  calculateSeverity,
  normalizeForComparison,
  generateDriftId,
  getCriticalChanges,
  groupChangesByPath,
  describeChange,
};

export default driftDetection;