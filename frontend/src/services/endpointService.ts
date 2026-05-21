import { api } from './api';
import type { PaginationParams, PaginatedResponse } from './api';

export interface Endpoint {
  id: string;
  projectId: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description?: string;
  status: 'active' | 'inactive' | 'deprecated';
  schemaId?: string;
  hasSchema: boolean;
  lastCheckedAt?: string;
  driftStatus: 'clean' | 'drifted' | 'unknown';
  createdAt: string;
  updatedAt: string;
}

export interface EndpointSchema {
  id: string;
  endpointId: string;
  version: number;
  schema: Record<string, unknown>;
  format: 'json-schema' | 'openapi' | 'graphql' | 'avro';
  validatedAt: string;
  createdAt: string;
}

export interface CreateEndpointRequest {
  projectId: string;
  name: string;
  method: Endpoint['method'];
  path: string;
  description?: string;
  schema?: Record<string, unknown>;
  format?: EndpointSchema['format'];
}

export interface UpdateEndpointRequest {
  name?: string;
  method?: Endpoint['method'];
  path?: string;
  description?: string;
  status?: Endpoint['status'];
}

export interface EndpointListParams extends PaginationParams {
  projectId: string;
  status?: Endpoint['status'];
  driftStatus?: Endpoint['driftStatus'];
  method?: Endpoint['method'];
  search?: string;
}

export interface SubmitSchemaRequest {
  schema: Record<string, unknown>;
  format?: EndpointSchema['format'];
}

export interface EndpointService {
  getEndpoints(projectId: string, params?: Omit<EndpointListParams, 'projectId'>): Promise<PaginatedResponse<Endpoint>>;
  getEndpoint(id: string): Promise<Endpoint>;
  createEndpoint(data: CreateEndpointRequest): Promise<Endpoint>;
  updateEndpoint(id: string, data: UpdateEndpointRequest): Promise<Endpoint>;
  deleteEndpoint(id: string): Promise<void>;
  getEndpointSchema(id: string): Promise<EndpointSchema>;
  submitSchema(endpointId: string, schema: SubmitSchemaRequest): Promise<EndpointSchema>;
}

class EndpointServiceImpl implements EndpointService {
  private readonly baseUrl = '/endpoints';

  async getEndpoints(
    projectId: string,
    params?: Omit<EndpointListParams, 'projectId'>
  ): Promise<PaginatedResponse<Endpoint>> {
    try {
      return await api.get<PaginatedResponse<Endpoint>>(this.baseUrl, {
        projectId,
        ...params,
      } as Record<string, unknown>);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getEndpoint(id: string): Promise<Endpoint> {
    try {
      return await api.get<Endpoint>(`${this.baseUrl}/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createEndpoint(data: CreateEndpointRequest): Promise<Endpoint> {
    try {
      return await api.post<Endpoint>(this.baseUrl, data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateEndpoint(id: string, data: UpdateEndpointRequest): Promise<Endpoint> {
    try {
      return await api.patch<Endpoint>(`${this.baseUrl}/${id}`, data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteEndpoint(id: string): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getEndpointSchema(id: string): Promise<EndpointSchema> {
    try {
      return await api.get<EndpointSchema>(`${this.baseUrl}/${id}/schema`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async submitSchema(endpointId: string, schema: SubmitSchemaRequest): Promise<EndpointSchema> {
    try {
      return await api.post<EndpointSchema>(`${this.baseUrl}/${endpointId}/schema`, schema);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error('An unexpected error occurred while fetching endpoints');
  }
}

export const endpointService = new EndpointServiceImpl();
export default endpointService;
