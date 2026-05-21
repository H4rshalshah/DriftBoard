import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';
import { useDriftStore, type DriftEvent } from './driftStore';
import { useEndpointStore, type Endpoint, type SchemaVersion } from './endpointStore';
import { useNotificationStore, type Notification } from './notificationStore';
import type { ProjectPermission, ProjectRole } from '../utils/permissions';

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  memberCount: number;
  endpointCount: number;
  lastDriftAt?: string;
  sourceType?: 'demo' | 'folder' | 'repository' | 'github' | 'upload' | 'manual';
  sourceLabel?: string;
  monitoringStatus?: 'active' | 'pending' | 'connected' | 'monitoring' | 'disconnected' | 'error';
  monitoringStartedAt?: string;
  monitoringEndsAt?: string | null;
  monitoringDuration?: string;
  currentUserRole?: ProjectRole | null;
  currentUserPermissions?: Partial<Record<ProjectPermission, boolean>>;
}

type DetectedEndpoint = {
  name?: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  currentSchema?: Record<string, unknown>;
};

type UploadedFileMetadata = {
  originalName: string;
  fileType?: string;
  fileSize?: number;
};

type ProjectStateResponse = {
  project: Project;
  endpoints: Endpoint[];
  uploadedFiles: Array<UploadedFileMetadata & { id: string; storedPath: string; uploadedAt: string }>;
  schemaVersions: SchemaVersion[];
  driftEvents: DriftEvent[];
  notifications: Notification[];
};

export type ProjectSortField = 'name' | 'createdAt' | 'updatedAt' | 'lastDriftAt';
export type SortOrder = 'asc' | 'desc';

interface ProjectFilters {
  search: string;
  sortBy: ProjectSortField;
  sortOrder: SortOrder;
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: string | null;
  filters: ProjectFilters;

  fetchProjects: () => Promise<void>;
  fetchCurrentProject: () => Promise<Project | null>;
  fetchProjectState: (id: string) => Promise<ProjectStateResponse>;
  fetchProject: (id: string) => Promise<void>;
  createProject: (data: {
    name: string;
    description: string;
    sourceType?: 'folder' | 'repository' | 'github' | 'upload' | 'manual';
    sourceLabel?: string;
    detectedEndpoints?: DetectedEndpoint[];
    uploadedFiles?: UploadedFileMetadata[];
    fileCount?: number;
    replaceExisting?: boolean;
  }) => Promise<Project>;
  updateProject: (id: string, data: Partial<{ name: string; description: string }>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  startMonitoring: (id: string, duration: string) => Promise<Project>;
  resumeMonitoring: (id: string, duration: string) => Promise<Project>;
  stopMonitoring: (id: string) => Promise<Project>;
  setCurrentProject: (project: Project | null) => void;
  setFilters: (filters: Partial<ProjectFilters>) => void;
  clearError: () => void;
}

const filteredProjectsSelector = (projects: Project[], filters: ProjectFilters): Project[] => {
  let result = [...projects];

  if (filters.search) {
    const search = filters.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.description.toLowerCase().includes(search)
    );
  }

  result.sort((a, b) => {
    const aVal = a[filters.sortBy] ?? '';
    const bVal = b[filters.sortBy] ?? '';
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return filters.sortOrder === 'asc' ? comparison : -comparison;
  });

  return result;
};

function hydrateProjectState(state: ProjectStateResponse) {
  useEndpointStore.setState({
    endpoints: state.endpoints,
    selectedProjectId: state.project.id,
    schemaHistory: state.schemaVersions,
  });
  useDriftStore.setState({
    driftEvents: state.driftEvents,
  });
  useNotificationStore.setState({
    notifications: state.notifications,
    unreadCount: state.notifications.filter((notification) => !notification.read).length,
  });
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProject: null,
      isLoading: false,
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      error: null,
      filters: {
        search: '',
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      },

      fetchProjects: async () => {
        set({ isLoading: true, error: null });
        try {
          const fetchedProjects = await api.get<Project[]>('/projects');
          set((state) => {
            const currentStillExists = state.currentProject
              ? fetchedProjects.some((project) => project.id === state.currentProject?.id)
              : false;

            return {
              projects: fetchedProjects,
              currentProject: currentStillExists
                ? state.currentProject
                : fetchedProjects.find((project) => project.id !== 'project_demo') || fetchedProjects[0] || null,
              isLoading: false,
            };
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : typeof error === 'object' && error && 'message' in error
                ? String((error as { message?: unknown }).message)
                : 'Failed to fetch projects';
          set({
            isLoading: false,
            error: message,
          });
        }
      },

      fetchCurrentProject: async () => {
        set({ isLoading: true, error: null });
        try {
          const project = await api.get<Project | null>('/projects/current');
          const fetchedProjects = await api.get<Project[]>('/projects');
          set({
            projects: fetchedProjects,
            currentProject: project,
            isLoading: false,
          });
          if (project?.id) {
            const state = await get().fetchProjectState(project.id);
            hydrateProjectState(state);
          }
          return project;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch current project';
          set({ isLoading: false, error: message });
          return null;
        }
      },

      fetchProjectState: async (id: string) => {
        const state = await api.get<ProjectStateResponse>(`/projects/${id}/state`);
        set((current) => ({
          projects: [state.project, ...current.projects.filter((project) => project.id !== state.project.id)],
          currentProject: state.project,
        }));
        hydrateProjectState(state);
        return state;
      },

      fetchProject: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const project = await api.get<Project>(`/projects/${id}`);
          set({ currentProject: project, isLoading: false });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to fetch project',
          });
        }
      },

      createProject: async (data) => {
        set({ isCreating: true, error: null });
        try {
          const project = await api.post<Project>('/projects', data);
          set((state) => ({
            projects: [project, ...state.projects.filter((item) => item.id === 'project_demo')],
            currentProject: project,
            isCreating: false,
          }));
          await get().fetchProjectState(project.id);
          return project;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : typeof error === 'object' && error && 'message' in error
                ? String((error as { message?: unknown }).message)
                : 'Failed to create project';
          if (typeof error === 'object' && error && 'code' in error && (error as { code?: string }).code === 'PROJECT_REPLACE_REQUIRED') {
            set({ isCreating: false, error: message });
            throw error;
          }
          set({ isCreating: false, error: message });
          throw new Error(message);
        }
      },

      updateProject: async (id, data) => {
        set({ isUpdating: true, error: null });
        const previousProjects = get().projects;

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
          ),
        }));

        try {
          const project = await api.patch<Project>(`/projects/${id}`, data);
          set((state) => ({
            currentProject: state.currentProject?.id === id ? project : state.currentProject,
            isUpdating: false,
          }));
        } catch (error) {
          set({ projects: previousProjects, isUpdating: false });
          set({
            error: error instanceof Error ? error.message : 'Failed to update project',
          });
          throw error;
        }
      },

      deleteProject: async (id) => {
        set({ isDeleting: true, error: null });
        const previousProjects = get().projects;

        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          currentProject: state.currentProject?.id === id ? null : state.currentProject,
        }));

        try {
          await api.delete(`/projects/${id}`);
          set({ isDeleting: false });
        } catch (error) {
          set({ projects: previousProjects, isDeleting: false });
          set({
            error: error instanceof Error ? error.message : 'Failed to delete project',
          });
          throw error;
        }
      },

      startMonitoring: async (id, duration) => {
        const project = await api.post<Project>(`/projects/${id}/monitoring/start`, { duration });
        set((state) => ({
          projects: state.projects.map((item) => (item.id === id ? project : item)),
          currentProject: state.currentProject?.id === id ? project : state.currentProject,
        }));
        return project;
      },

      resumeMonitoring: async (id, duration) => {
        const project = await api.post<Project>(`/projects/${id}/resume-monitoring`, { duration });
        set((state) => ({
          projects: state.projects.map((item) => (item.id === id ? project : item)),
          currentProject: state.currentProject?.id === id ? project : state.currentProject,
        }));
        return project;
      },

      stopMonitoring: async (id) => {
        const project = await api.post<Project>(`/projects/${id}/monitoring/stop`);
        set((state) => ({
          projects: state.projects.map((item) => (item.id === id ? project : item)),
          currentProject: state.currentProject?.id === id ? project : state.currentProject,
        }));
        return project;
      },

      setCurrentProject: (project) => {
        set({ currentProject: project });
      },

      setFilters: (filters) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }));
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'project-storage',
      partialize: (state) => ({
        projects: state.projects,
        currentProject: state.currentProject,
        filters: state.filters,
      }),
    }
  )
);

export const selectFilteredProjects = (state: ProjectState) =>
  filteredProjectsSelector(state.projects, state.filters);
export const selectCurrentProject = (state: ProjectState) => state.currentProject;
