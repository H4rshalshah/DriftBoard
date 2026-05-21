/**
 * Schema Parser Utilities for DriftBoard
 * JSON Schema extraction and normalization
 */

import { inferTypes } from './driftDetection';

/**
 * JSON Schema structure (Draft-07 compatible subset)
 */
export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  required?: string[];
  description?: string;
  enum?: any[];
  const?: any;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  additionalProperties?: boolean | JsonSchema;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default?: any;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  example?: any;
  title?: string;
  $ref?: string;
  definitions?: Record<string, JsonSchema>;
  [key: string]: any;
}

/**
 * Simplified schema for storage and comparison
 */
export interface SimpleSchema {
  type: string;
  properties?: Record<string, SimpleSchema>;
  required?: string[];
  isArray?: boolean;
  itemType?: string;
  enum?: any[];
  nullable?: boolean;
}

/**
 * Extract JSON Schema from a JavaScript object
 * Infers types from actual values
 * @param obj - JavaScript object to extract schema from
 * @returns JSON Schema representation
 */
export function extractSchema(obj: any): JsonSchema {
  if (obj === null) {
    return { type: 'null', nullable: true };
  }

  if (obj === undefined) {
    return { type: 'undefined' };
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return { type: 'array', items: {} };
    }

    const itemSchemas = obj.map(item => extractSchema(item));
    const mergedSchema = mergeArraySchemas(itemSchemas);

    return {
      type: 'array',
      items: mergedSchema,
    };
  }

  const type = inferTypes(obj);

  if (type === 'object') {
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      properties[key] = extractSchema(value);
      
      if (value !== null && value !== undefined) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  if (type === 'array') {
    return extractSchema(obj);
  }

  const schema: JsonSchema = { type };

  if (type === 'string') {
    if (typeof obj === 'string') {
      if (obj.length > 0) {
        schema.examples = [obj];
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(obj)) {
        schema.format = 'date-time';
      } else if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(obj)) {
        schema.format = 'email';
      } else if (/^https?:\/\//.test(obj)) {
        schema.format = 'uri';
      }
    }
  }

  if (type === 'number' || type === 'integer') {
    if (typeof obj === 'number') {
      schema.examples = [obj];
    }
  }

  if (type === 'boolean') {
    schema.examples = [obj];
  }

  return schema;
}

/**
 * Merge schemas from array items
 * @param schemas - Array of schemas to merge
 * @returns Merged schema
 */
function mergeArraySchemas(schemas: JsonSchema[]): JsonSchema {
  if (schemas.length === 0) {
    return {};
  }

  if (schemas.length === 1) {
    return schemas[0];
  }

  const types = new Set(schemas.map(s => s.type).filter(Boolean));
  const propertiesMap = new Map<string, JsonSchema[]>();
  const hasObjects = schemas.some(s => s.type === 'object' && s.properties);

  for (const schema of schemas) {
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        const existing = propertiesMap.get(key) || [];
        existing.push(propSchema);
        propertiesMap.set(key, existing);
      }
    }
  }

  const mergedSchema: JsonSchema = {
    type: types.size === 1 ? Array.from(types)[0] : 'any',
  };

  if (hasObjects && propertiesMap.size > 0) {
    const properties: Record<string, JsonSchema> = {};
    
    for (const [key, propSchemas] of propertiesMap.entries()) {
      properties[key] = mergeSchemas(propSchemas);
    }

    mergedSchema.type = 'object';
    mergedSchema.properties = properties;
  }

  const enums = schemas.flatMap(s => s.enum || []).filter((v, i, a) => a.indexOf(v) === i);
  if (enums.length > 0 && enums.length <= 10) {
    mergedSchema.enum = enums;
  }

  const nullableCount = schemas.filter(s => s.nullable === true).length;
  if (nullableCount > 0) {
    mergedSchema.nullable = nullableCount === schemas.length;
  }

  return mergedSchema;
}

/**
 * Merge multiple schemas into one
 * @param schemas - Schemas to merge
 * @returns Merged schema
 */
function mergeSchemas(schemas: JsonSchema[]): JsonSchema {
  if (schemas.length === 0) {
    return {};
  }

  if (schemas.length === 1) {
    return schemas[0];
  }

  const types = new Set(schemas.map(s => s.type).filter(Boolean));
  
  const merged: JsonSchema = {
    type: types.size === 1 ? Array.from(types)[0] : 'any',
  };

  if (types.size > 1) {
    merged.anyOf = schemas;
  }

  const allObjects = schemas.every(s => s.type === 'object' && s.properties);
  if (allObjects) {
    const properties: Record<string, JsonSchema> = {};
    const allProps = schemas.flatMap(s => Object.entries(s.properties || {}));
    const propMap = new Map<string, JsonSchema[]>();

    for (const [key, propSchema] of allProps) {
      const existing = propMap.get(key) || [];
      existing.push(propSchema);
      propMap.set(key, existing);
    }

    for (const [key, propSchemas] of propMap.entries()) {
      properties[key] = mergeSchemas(propSchemas);
    }

    merged.properties = properties;
  }

  return merged;
}

/**
 * Simplify a schema for storage
 * @param schema - Full JSON schema
 * @returns Simplified schema
 */
export function simplifySchema(schema: JsonSchema): SimpleSchema {
  const simplified: SimpleSchema = {
    type: schema.type || 'any',
  };

  if (schema.properties) {
    simplified.properties = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      simplified.properties[key] = simplifySchema(value);
    }
  }

  if (schema.required) {
    simplified.required = schema.required;
  }

  if (schema.type === 'array' && schema.items) {
    simplified.isArray = true;
    if (!Array.isArray(schema.items)) {
      simplified.itemType = schema.items.type || 'any';
    }
  }

  if (schema.nullable) {
    simplified.nullable = true;
  }

  if (schema.enum) {
    simplified.enum = schema.enum;
  }

  return simplified;
}

/**
 * Normalize a schema for comparison
 * Removes non-essential properties and standardizes format
 * @param schema - Schema to normalize
 * @returns Normalized schema object
 */
export function normalizeSchema(schema: object): object {
  if (schema === null || schema === undefined) {
    return {};
  }

  if (Array.isArray(schema)) {
    return [];
  }

  if (typeof schema !== 'object') {
    return schema;
  }

  const normalized: any = {};
  const obj = schema as Record<string, any>;

  const importantKeys = [
    'type', 'properties', 'items', 'required', 
    'enum', 'const', 'additionalProperties',
    'nullable', 'format', 'minimum', 'maximum',
    'minLength', 'maxLength', 'pattern'
  ];

  for (const key of importantKeys) {
    if (obj[key] !== undefined) {
      if (key === 'properties' && typeof obj[key] === 'object') {
        const props: Record<string, any> = {};
        for (const [propKey, propValue] of Object.entries(obj[key])) {
          props[propKey] = normalizeSchema(propValue);
        }
        normalized[key] = props;
      } else if (key === 'items') {
        normalized[key] = normalizeSchema(obj[key]);
      } else if (Array.isArray(obj[key])) {
        normalized[key] = obj[key].map(item => 
          typeof item === 'object' ? normalizeSchema(item) : item
        );
      } else if (typeof obj[key] === 'object') {
        normalized[key] = normalizeSchema(obj[key]);
      } else {
        normalized[key] = obj[key];
      }
    }
  }

  const sortKeys = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sortKeys);
    }

    const sorted: any = {};
    const keys = Object.keys(obj).sort();
    
    for (const key of keys) {
      sorted[key] = sortKeys(obj[key]);
    }
    
    return sorted;
  };

  return sortKeys(normalized);
}

/**
 * Get all field paths from a schema
 * @param schema - Schema to traverse
 * @param prefix - Current path prefix
 * @returns Array of field paths
 */
export function getFieldPaths(schema: object, prefix: string = ''): string[] {
  if (!schema || typeof schema !== 'object') {
    return prefix ? [prefix] : [];
  }

  const paths: string[] = [];
  const obj = schema as Record<string, any>;

  if (obj.properties) {
    for (const [key, value] of Object.entries(obj.properties)) {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object') {
        if (value.type === 'object' && value.properties) {
          paths.push(...getFieldPaths(value, currentPath));
        } else {
          paths.push(currentPath);
        }
      } else {
        paths.push(currentPath);
      }
    }
  }

  if (obj.items && typeof obj.items === 'object') {
    const itemPath = prefix ? `${prefix}[*]` : '[*]';
    
    if (obj.items.properties) {
      paths.push(...getFieldPaths(obj.items, itemPath));
    } else {
      paths.push(itemPath);
    }
  }

  return paths;
}

/**
 * Compare two schemas and return differences
 * @param schema1 - First schema
 * @param schema2 - Second schema
 * @returns List of differences
 */
export function compareSchemaStructure(
  schema1: object,
  schema2: object
): { path: string; type: string; schema1?: any; schema2?: any }[] {
  const differences: { path: string; type: string; schema1?: any; schema2?: any }[] = [];
  
  const traverse = (
    s1: any,
    s2: any,
    path: string
  ): void => {
    if (typeof s1 !== 'object' || typeof s2 !== 'object') {
      if (s1 !== s2) {
        differences.push({ path, type: 'value', schema1: s1, schema2: s2 });
      }
      return;
    }

    const keys1 = s1 ? Object.keys(s1) : [];
    const keys2 = s2 ? Object.keys(s2) : [];
    const allKeys = new Set([...keys1, ...keys2]);

    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (!(key in s1)) {
        differences.push({ path: currentPath, type: 'added', schema2: s2[key] });
      } else if (!(key in s2)) {
        differences.push({ path: currentPath, type: 'removed', schema1: s1[key] });
      } else if (typeof s1[key] === 'object' && typeof s2[key] === 'object') {
        traverse(s1[key], s2[key], currentPath);
      } else if (s1[key] !== s2[key]) {
        differences.push({ 
          path: currentPath, 
          type: 'modified', 
          schema1: s1[key], 
          schema2: s2[key] 
        });
      }
    }
  };

  traverse(schema1, schema2, '');
  return differences;
}

export default {
  extractSchema,
  simplifySchema,
  normalizeSchema,
  getFieldPaths,
  compareSchemaStructure,
};