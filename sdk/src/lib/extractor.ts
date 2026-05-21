import { Request, Response } from 'express';

export function getType(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const type = typeof value;

  if (type === 'object') {
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (value instanceof RegExp) return 'regex';
    return 'object';
  }

  return type;
}

export function extractSchema(obj: any): object {
  if (obj === null || obj === undefined) {
    return { type: 'null' };
  }

  const type = getType(obj);

  switch (type) {
    case 'string':
      return { type: 'string' };

    case 'number':
      return Number.isInteger(obj) ? { type: 'integer' } : { type: 'number' };

    case 'boolean':
      return { type: 'boolean' };

    case 'array':
      if (obj.length === 0) {
        return { type: 'array', items: {} };
      }
      return {
        type: 'array',
        items: extractSchema(obj[0]),
        minItems: obj.length,
        maxItems: obj.length
      };

    case 'object':
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const key of Object.keys(obj)) {
        properties[key] = extractSchema(obj[key]);
        if (obj[key] !== undefined && obj[key] !== null) {
          required.push(key);
        }
      }

      if (Object.keys(properties).length === 0) {
        return { type: 'object' };
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined
      };

    case 'date':
      return { type: 'string', format: 'date-time' };

    default:
      return { type: 'unknown' };
  }
}

export function simplifyObject(obj: any, depth: number = 3, currentDepth: number = 0): any {
  if (currentDepth >= depth) {
    return typeof obj === 'object' ? '[object]' : obj;
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  const type = getType(obj);

  switch (type) {
    case 'string':
    case 'number':
    case 'boolean':
      return obj;

    case 'array':
      return obj.map((item: any) => simplifyObject(item, depth, currentDepth + 1));

    case 'object':
      const simplified: Record<string, any> = {};
      const keys = Object.keys(obj).slice(0, 50);
      for (const key of keys) {
        simplified[key] = simplifyObject(obj[key], depth, currentDepth + 1);
      }
      return simplified;

    default:
      return obj;
  }
}

export function extractFromRequest(req: Request): object {
  const schema: any = {
    method: req.method,
    path: req.path,
    query: req.query && Object.keys(req.query).length > 0 ? { type: 'object' } : undefined,
    headers: {} as Record<string, any>
  };

  if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
    if (req.body && typeof req.body === 'object') {
      schema.body = extractSchema(req.body);
    }
  }

  const headerWhitelist = ['content-type', 'authorization', 'accept', 'user-agent'];
  for (const header of headerWhitelist) {
    if (req.headers[header]) {
      schema.headers[header] = { type: 'string' };
    }
  }

  if (req.params && Object.keys(req.params).length > 0) {
    schema.params = extractSchema(req.params);
  }

  return schema;
}

export function extractFromResponse(res: Response): object {
  const schema: any = {
    statusCode: res.statusCode
  };

  const locals = res.locals;
  if (locals && locals.driftboardBody) {
    try {
      schema.body = extractSchema(locals.driftboardBody);
    } catch {
      schema.body = { type: 'unknown' };
    }
  }

  return schema;
}

export function captureResponseBody(res: Response): void {
  const originalSend = res.send;
  const originalJson = res.json;

  res.send = function (body: any): Response {
    res.locals = res.locals || {};
    res.locals.driftboardBody = body;
    return originalSend.call(this, body);
  };

  res.json = function (body: any): Response {
    res.locals = res.locals || {};
    res.locals.driftboardBody = body;
    return originalJson.call(this, body);
  };
}