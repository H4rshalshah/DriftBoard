import { api } from './api';
import type { PaginationParams, PaginatedResponse } from './api';

export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  status: 'active' | 'inactive' | 'archived';
  endpointsCount: number;
  driftCount: number;
  lastDriftAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStats {
  totalEndpoints: number;
  activeEndpoints: number;
  totalDriftEvents: number;
  unacknowledgedDrift: number;
  driftBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  driftTrend: Array<{
    date: string;
    count: number;
  }>;
  schemaCoverage: number;
  recentActivity: Array<{
    id: string;
    type: 'drift' | 'schema_update' | 'endpoint_created' | 'endpoint_deleted';
    description: string;
    timestamp: string;
  }>;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: 'active' | 'inactive' | 'archived';
}

export interface ProjectListParams extends PaginationParams {
  status?: 'active' | 'inactive' | 'archived';
  search?: string;
}

export interface ProjectService {
  getProjects(params?: ProjectListParams): Promise<PaginatedResponse<Project>>;
  getProject(id: string): Promise<Project>;
  createProject(data: CreateProjectRequest): Promise<Project>;
  updateProject(id: string, data: UpdateProjectRequest): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  getProjectStats(id: string): Promise<ProjectStats>;
}

class ProjectServiceImpl implements ProjectService {
  private readonly baseUrl = '/projects';

  async getProjects(params?: ProjectListParams): Promise<PaginatedResponse<Project>> {
    try {
      return await api.get<PaginatedResponse<Project>>(this.baseUrl, params as Record<string, unknown>);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getProject(id: string): Promise<Project> {
    try {
      return await api.get<Project>(`${this.baseUrl}/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createProject(data: CreateProjectRequest): Promise<Project> {
    try {
      return await api.post<Project>(this.baseUrl, data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateProject(id: string, data: UpdateProjectRequest): Promise<Project> {
    try {
      return await api.patch<Project>(`${this.baseUrl}/${id}`, data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteProject(id: string): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getProjectStats(id: string): Promise<ProjectStats> {
    try {
      return await api.get<ProjectStats>(`${this.baseUrl}/${id}/stats`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error('An unexpected error occurred while fetching projects');
  }
}

export const projectService = new ProjectServiceImpl();
export default projectService;
