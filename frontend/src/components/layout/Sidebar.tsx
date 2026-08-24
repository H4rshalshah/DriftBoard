import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore, useProjectStore, useAuthStore, useEndpointStore } from '@/store';
import { api } from '@/services/api';
import { DriftBoardLogo } from '@/components/common/DriftBoardLogo';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import {
  LayoutDashboard,
  Network,
  AlertTriangle,
  History,
  Bell,
  Mail,
  Settings,
  Key,
  Menu,
  ChevronDown,
  LogOut,
  User,
  Plus,
  FolderOpen,
  GitBranch,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { hasProjectPermission } from '@/utils/permissions';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

type DetectedEndpoint = {
  name?: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  currentSchema?: Record<string, unknown>;
  sourceFile?: string;
  monitoringEnabled?: boolean;
};

type SourceFilePayload = {
  originalName: string;
  fileType: string;
  fileSize: number;
  content: string;
};

const navItems: NavItem[] = [
  { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/app/endpoints', label: 'Endpoints', icon: Network },
  { path: '/app/drift-events', label: 'Drift Events', icon: AlertTriangle },
  { path: '/app/schema-history', label: 'Schema History', icon: History },
  { path: '/app/notifications', label: 'Notifications', icon: Bell },
  { path: '/app/settings', label: 'Settings', icon: Settings },
  { path: '/app/api-keys', label: 'API Keys', icon: Key },
  { path: '/app/contact', label: 'Contact', icon: Mail },
];

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function projectNameFromSourceName(sourceName: string) {
  return sourceName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarCollapsed, sidebarOpen, setSidebarCollapsed, setSidebarOpen } = useUIStore();
  const { projects, currentProject, setCurrentProject, fetchProjects, createProject, deleteProject, isLoading, isCreating, isDeleting } = useProjectStore();
  const { fetchEndpoints } = useEndpointStore();
  const { user, logout } = useAuthStore();
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [projectSetupOpen, setProjectSetupOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [sourceType, setSourceType] = useState<'folder' | 'repository'>('folder');
  const [repoUrl, setRepoUrl] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [selectedSourceName, setSelectedSourceName] = useState('');
  const [selectedFileCount, setSelectedFileCount] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [setupError, setSetupError] = useState('');
  const [setupStatus, setSetupStatus] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const effectiveCollapsed = !isMobile && sidebarCollapsed;

  const sidebarVariants = {
    expanded: { width: 260 },
    collapsed: { width: 96 },
  };

  const navItemVariants = {
    hidden: { opacity: 0, x: -16 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * 0.04,
        duration: 0.25,
      },
    }),
  };

  const canCreateWorkspaceProject = user?.role === 'owner' || user?.role === 'admin';
  const canCreateFromProjectRole = hasProjectPermission(currentProject?.currentUserRole, 'project:create');
  const canOpenProjectSetup = canCreateWorkspaceProject || canCreateFromProjectRole || !currentProject;

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!currentProject && projects.length > 0) {
      setCurrentProject(projects[0]);
    }
  }, [currentProject, projects, setCurrentProject]);

  const openProjectSetup = () => {
    if (!canOpenProjectSetup) {
      setSetupError('You do not have permission to perform this action.');
      return;
    }
    setUserMenuOpen(false);
    setProjectDropdownOpen(false);
    setProjectSetupOpen(true);
  };

  const closeProjectSetup = () => {
    setProjectSetupOpen(false);
    setProjectName('');
    setRepoUrl('');
    setApiBaseUrl('');
    setSelectedSourceName('');
    setSelectedFileCount(0);
    setSelectedFiles([]);
    setSetupError('');
    setSetupStatus('');
    setSourceType('folder');
  };

  const getScannableSourceFiles = (files: File[]) => files
    .filter((file) => {
      const path = `${file.webkitRelativePath || file.name}`.toLowerCase();
      return (
        /\.(js|jsx|ts|tsx|mjs|cjs|json|yaml|yml|py|php|rb|go|java|kt|cs)$/.test(path) &&
        !path.includes('/node_modules/') &&
        !path.includes('/dist/') &&
        !path.includes('/build/') &&
        !path.includes('/coverage/') &&
        file.size <= 1_800_000
      );
    })
    .sort((left, right) => {
      const score = (file: File) => {
        const name = `${file.webkitRelativePath || file.name}`.toLowerCase();
        if (/openapi|swagger|postman|collection|insomnia/.test(name)) return 0;
        if (/\.(json|yaml|yml)$/.test(name)) return 1;
        return 2;
      };
      return score(left) - score(right);
    });

  const applySelectedSourceFiles = (files: File[]) => {
    const sourceName = files[0]?.webkitRelativePath?.split('/')[0] || files[0]?.name || '';
    setSelectedFileCount(files.length);
    setSelectedFiles(files);
    setSelectedSourceName(sourceName);
    setProjectName((current) => current.trim() || projectNameFromSourceName(sourceName));
    setSetupError('');
  };

  const detectEndpointsFromFiles = async (files: File[]) => {
    const routeFiles = files.filter((file) => {
      const path = `${file.webkitRelativePath || file.name}`.toLowerCase();
      return (
        /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(path) &&
        !path.includes('/node_modules/') &&
        !path.includes('/dist/') &&
        !path.includes('/build/')
      );
    });

    const routePattern =
      /\b(?:app|router|server)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    const endpoints = new Map<string, { name: string; url: string; method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; currentSchema: Record<string, unknown> }>();

    for (const file of routeFiles.slice(0, 80)) {
      const text = await file.text();
      let match: RegExpExecArray | null;

      while ((match = routePattern.exec(text))) {
        const method = match[1].toUpperCase() as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        const url = match[2].startsWith('/') ? match[2] : `/${match[2]}`;
        const key = `${method}:${url}`;
        const cleanName = url
          .split('/')
          .filter(Boolean)
          .map((part) => part.replace(/^:/, '').replace(/[-_]/g, ' '))
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');

        endpoints.set(key, {
          name: `${method} ${cleanName || 'Root'}`,
          url,
          method,
          currentSchema: {
            status: 'string',
            data: 'object',
          },
        });
      }
    }

    return Array.from(endpoints.values()).slice(0, 24);
  };

  const readSourceFilesForUpload = async (files: File[]): Promise<SourceFilePayload[]> => {
    const sourceFiles = getScannableSourceFiles(files).slice(0, 250);
    const payloads = await Promise.all(
      sourceFiles.map(async (file) => ({
        originalName: file.webkitRelativePath || file.name,
        fileType: file.type || file.name.split('.').pop() || 'file',
        fileSize: file.size,
        content: await file.text(),
      }))
    );

    return payloads.filter((file) => file.content.trim().length > 0);
  };

  const uploadSourceFilesForBackendScan = async (projectId: string, files: SourceFilePayload[]) => {
    const detected = new Map<string, DetectedEndpoint>();

    for (const file of files) {
      const response = await api.post<{ detectedEndpoints: DetectedEndpoint[] }>(`/projects/${projectId}/files/detect-endpoints`, {
        file,
      });

      response.detectedEndpoints.forEach((endpoint) => {
        const key = `${endpoint.method}:${endpoint.url}`;
        if (!detected.has(key)) detected.set(key, endpoint);
      });
    }

    const detectedEndpoints = Array.from(detected.values());
    if (detectedEndpoints.length > 0) {
      await api.post(`/projects/${projectId}/endpoints/import-detected`, {
        endpoints: detectedEndpoints,
      });
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project || project.id === 'project_demo' || project.sourceType === 'demo') return;
    const canDelete = project.ownerId === user?.id || hasProjectPermission(project.currentUserRole, 'project:delete');
    if (!canDelete) {
      window.alert('Only the project owner can delete this project.');
      return;
    }
    const confirmed = window.confirm(`Delete ${project.name}? This removes its endpoints, drift history, uploads, keys, and team data.`);
    if (!confirmed) return;

    try {
      await deleteProject(project.id);
      const nextProject = projects.find((item) => item.id !== project.id && item.id !== 'project_demo')
        || projects.find((item) => item.id !== project.id)
        || null;
      setCurrentProject(nextProject);
      if (nextProject?.id) {
        await fetchEndpoints(nextProject.id);
      }
      setProjectDropdownOpen(false);
      navigate('/app/dashboard');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to delete this project.');
    }
  };

  const handleCreateProject = async () => {
    setSetupError('');
    const effectiveProjectName = projectName.trim() || projectNameFromSourceName(selectedSourceName);

    if (!effectiveProjectName) {
      setSetupError('Project name is required.');
      return;
    }

    if (sourceType === 'folder' && !selectedSourceName) {
      setSetupError('Select your project folder before creating the project.');
      return;
    }

    if (sourceType === 'repository' && !repoUrl.trim()) {
      setSetupError('Repository URL is required.');
      return;
    }

    const sourceLabel =
      sourceType === 'repository'
        ? repoUrl.trim()
        : `${selectedSourceName} (${selectedFileCount.toLocaleString()} files)`;
    const savedProject = projects.find((project) => project.id !== 'project_demo');
    const isSameSavedProject =
      savedProject &&
      (savedProject.sourceLabel === sourceLabel ||
        savedProject.name.trim().toLowerCase() === effectiveProjectName.toLowerCase());
    const replaceExisting =
      Boolean(savedProject && !isSameSavedProject) &&
      window.confirm(`Replace ${savedProject?.name} with ${effectiveProjectName} as your live project? Your old live project data will be removed.`);

    if (savedProject && !isSameSavedProject && !replaceExisting) {
      return;
    }

    try {
      setSetupStatus('Reading project source and detecting endpoints...');
      const detectedEndpoints = sourceType === 'folder' ? await detectEndpointsFromFiles(selectedFiles) : [];
      const filesToUpload = sourceType === 'folder' ? await readSourceFilesForUpload(selectedFiles) : [];
      const uploadedFiles = sourceType === 'folder'
        ? selectedFiles.slice(0, 500).map((file) => ({
            originalName: file.webkitRelativePath || file.name,
            fileType: file.type || file.name.split('.').pop() || 'file',
            fileSize: file.size,
          }))
        : [];

      setSetupStatus('Creating project and starting monitoring...');
      const project = await createProject({
        name: effectiveProjectName,
        description: `Monitoring active. Source: ${sourceLabel}. DriftBoard will fetch project details, track endpoints, store schema snapshots, compare new versions, and surface drift errors for this project.`,
        sourceType,
        sourceLabel,
        apiBaseUrl: apiBaseUrl.trim() || undefined,
        detectedEndpoints,
        uploadedFiles,
        fileCount: selectedFileCount,
        replaceExisting,
      });

      setCurrentProject(project);
      if (filesToUpload.length > 0) {
        setSetupStatus('Scanning uploaded project files for endpoints and schemas...');
        await uploadSourceFilesForBackendScan(project.id, filesToUpload);
      }
      setSetupStatus('Loading monitored endpoints...');
      await fetchEndpoints(project.id);
      closeProjectSetup();
      navigate('/app/endpoints');
    } catch (error) {
      setSetupStatus('');
      setSetupError(error instanceof Error ? error.message : 'Unable to create and monitor this project.');
    }
  };

  const isDemoProject = currentProject?.name?.toLowerCase().includes('demo');
  const canCreateProject =
    (projectName.trim().length > 0 || (sourceType === 'folder' && selectedSourceName.length > 0)) &&
    (sourceType === 'repository' ? repoUrl.trim().length > 0 : selectedSourceName.length > 0);

  return (
    <motion.aside
      className={cn(
        'fixed left-0 top-0 h-screen z-40',
        'app-sidebar-surface',
        'flex flex-col transition-transform duration-300 lg:transition-colors',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
      initial={false}
      animate={effectiveCollapsed ? 'collapsed' : 'expanded'}
      variants={sidebarVariants}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <div
        className={cn(
          'relative flex h-16 items-center border-b border-white/[0.06] p-3',
          effectiveCollapsed ? 'justify-start gap-5 pl-4 pr-3' : 'justify-between pr-16'
        )}
      >
        <AnimatePresence mode="wait">
          {!effectiveCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <DriftBoardLogo />
            </motion.div>
          )}
        </AnimatePresence>
        {effectiveCollapsed && canOpenProjectSetup && (
          <DriftBoardLogo compact />
        )}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={cn(
            'z-50 place-items-center rounded-md text-white/40',
            'hidden transition-colors duration-200 hover:text-white/80 lg:inline-grid',
            effectiveCollapsed
              ? 'relative right-auto top-auto h-10 w-10 translate-y-0 p-0'
              : 'absolute right-5 top-1/2 h-10 w-10 -translate-y-1/2 p-0'
          )}
          aria-label={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className={cn('flex-1 overflow-y-auto scrollbar-thin py-4', effectiveCollapsed ? 'px-2' : 'px-3')}>
        <nav className="space-y-0.5">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);

            return (
              <motion.div
                key={item.path}
                custom={index}
                initial="hidden"
                animate="visible"
                variants={navItemVariants}
              >
                <NavLink
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg',
                    'transition-all duration-150 group relative',
                    isActive
                      ? 'bg-primary-500/8 text-primary-400'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03]'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary-500 rounded-r-full"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon className={cn('w-[18px] h-[18px] flex-shrink-0', isActive && 'text-primary-400')} />
                  {!effectiveCollapsed && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                </NavLink>
              </motion.div>
            );
          })}
        </nav>
      </div>

      <div className={cn('border-t border-white/[0.06] p-3', effectiveCollapsed && 'px-2')}>
        {effectiveCollapsed && (
          <div className="relative mb-2">
            <button
              onClick={openProjectSetup}
              disabled={isCreating}
              className={cn(
                'grid h-11 w-full place-items-center rounded-lg bg-white/[0.03] text-primary-400',
                'transition-colors duration-150 hover:bg-white/5 hover:text-white/80',
                'disabled:cursor-not-allowed disabled:opacity-40'
              )}
              aria-label="Create project"
              title="Create project"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        )}

        {!effectiveCollapsed && (
          <div className="mb-3">
            <button
              onClick={() => {
                if (isDemoProject) {
                  if (canOpenProjectSetup) openProjectSetup();
                  return;
                }

                setProjectDropdownOpen(!projectDropdownOpen);
                setUserMenuOpen(false);
              }}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-3 py-2',
                'bg-white/[0.03] hover:bg-white/5 rounded-lg',
                'text-sm text-white/50 transition-colors duration-150'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded bg-primary-500/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-primary-400">
                    {currentProject?.name?.[0] || 'P'}
                  </span>
                </div>
                <span className="truncate">
                  {currentProject?.name || (isLoading ? 'Loading project...' : 'Select Project')}
                </span>
              </div>
              <ChevronDown className={cn('w-4 h-4 flex-shrink-0 transition-transform', projectDropdownOpen && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {projectDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="sidebar-menu-surface relative z-[55] mt-2 overflow-hidden rounded-lg py-1 shadow-2xl"
                >
                  {projects.length === 0 && (
                    <div className="px-3 py-2 text-sm text-white/30">
                      {isLoading ? 'Loading projects...' : 'No projects found'}
                    </div>
                  )}
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-sm',
                        'hover:bg-white/5 transition-colors duration-150',
                        currentProject?.id === project.id ? 'text-primary-400' : 'text-white/60'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentProject(project);
                          setProjectDropdownOpen(false);
                        }}
                        className="min-w-0 flex-1 truncate text-left"
                      >
                        {project.name}
                      </button>
                      {project.id !== 'project_demo' && project.sourceType !== 'demo' && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDeleteProject(project.id);
                          }}
                          disabled={isDeleting || !(project.ownerId === user?.id || hasProjectPermission(project.currentUserRole, 'project:delete'))}
                          className="rounded p-1 text-white/25 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-20"
                          aria-label={`Delete ${project.name}`}
                          title="Delete project"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {canOpenProjectSetup && (
                    <>
                      <div className="my-1 h-px bg-white/[0.06]" />
                      <button
                        onClick={openProjectSetup}
                        disabled={isCreating}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary-400 transition-colors duration-150 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="h-4 w-4" />
                        {isCreating ? 'Creating...' : 'Create your project'}
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setProjectDropdownOpen(false);
            }}
            className={cn(
              'flex items-center gap-3 w-full p-2 rounded-lg',
              'hover:bg-white/[0.03] transition-colors duration-150',
              effectiveCollapsed && 'justify-center'
            )}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
            {!effectiveCollapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-white/80 truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-white/30 truncate">{user?.email}</p>
                </div>
              </>
            )}
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={cn(
                  'sidebar-menu-surface absolute bottom-full z-[60] mb-2 w-full py-1',
                  'overflow-hidden rounded-lg shadow-2xl',
                  effectiveCollapsed ? 'left-0' : 'left-0'
                )}
              >
                <button
                  onClick={() => {
                    logout();
                    setUserMenuOpen(false);
                  }}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2 text-sm',
                    'text-white/50 hover:bg-white/5 hover:text-red-400',
                    'transition-colors duration-150'
                  )}
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Modal
        isOpen={projectSetupOpen}
        onClose={closeProjectSetup}
        size="lg"
        className="h-[min(680px,calc(100vh-4rem))]"
      >
        <ModalHeader className="pb-2">
          <h2 className="text-xl font-semibold text-white">Add your project</h2>
          <p className="mt-1 text-sm leading-5 text-white/40">
            Connect the project you want DriftBoard to watch for endpoint changes, schema drift, and breaking API updates.
          </p>
        </ModalHeader>
        <ModalBody className="space-y-4 pb-5">
          <Input
            label="Project name"
            placeholder="e.g., My SaaS API"
            value={projectName}
            onChange={(event) => {
              setProjectName(event.target.value);
              setSetupError('');
            }}
          />

          <div>
            <label className="mb-2 block text-sm font-medium text-white/60">Project source</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSourceType('folder')}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  sourceType === 'folder'
                    ? 'border-primary-500/40 bg-primary-500/8 text-white'
                    : 'border-white/[0.06] bg-white/[0.02] text-white/60 hover:bg-white/5'
                )}
              >
                <FolderOpen className="mb-1.5 h-5 w-5 text-primary-400" />
                <span className="block font-medium">Upload local project</span>
                <span className="mt-1 block text-xs leading-4 text-white/35">Select your app folder from this machine.</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceType('repository')}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  sourceType === 'repository'
                    ? 'border-primary-500/40 bg-primary-500/8 text-white'
                    : 'border-white/[0.06] bg-white/[0.02] text-white/60 hover:bg-white/5'
                )}
              >
                <GitBranch className="mb-1.5 h-5 w-5 text-primary-400" />
                <span className="block font-medium">Use repository URL</span>
                <span className="mt-1 block text-xs leading-4 text-white/35">Attach a GitHub/GitLab project URL.</span>
              </button>
            </div>
          </div>

          {sourceType === 'folder' ? (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/10 px-4 py-5 text-center transition-colors hover:border-primary-500/30 hover:bg-white/[0.02]">
                <FolderOpen className="mb-2 h-6 w-6 text-primary-400" />
                <span className="text-sm font-medium text-white">
                  {selectedSourceName || 'Choose project folder'}
                </span>
                <span className="mt-1 text-xs text-white/30">
                  {selectedFileCount > 0 ? `${selectedFileCount} files selected` : 'Your folder is used to set up this DriftBoard project.'}
                </span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => applySelectedSourceFiles(Array.from(event.target.files || []))}
                  {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                />
              </label>
              <label className="mt-3 flex cursor-pointer items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm font-medium text-white/60 transition-colors hover:border-primary-500/25 hover:bg-white/5">
                Choose JSON/OpenAPI files
                <input
                  type="file"
                  multiple
                  accept=".json,.yaml,.yml,application/json"
                  className="hidden"
                  onChange={(event) => applySelectedSourceFiles(Array.from(event.target.files || []))}
                />
              </label>
            </div>
          ) : (
            <Input
              label="Repository URL"
              placeholder="https://github.com/you/your-api"
              value={repoUrl}
              onChange={(event) => {
                setRepoUrl(event.target.value);
                setSetupError('');
              }}
            />
          )}

          <Input
            label="API base URL"
            placeholder="https://api.example.com"
            value={apiBaseUrl}
            onChange={(event) => {
              setApiBaseUrl(event.target.value);
              setSetupError('');
            }}
          />

          {setupError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-400">
              {setupError}
            </div>
          )}

          {setupStatus && (
            <div className="rounded-lg border border-primary-500/20 bg-primary-500/8 px-3 py-2 text-xs text-primary-400">
              {setupStatus}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-primary-500/15 bg-primary-500/5 p-3 text-xs leading-5 text-white/50">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-400" />
            <span>
              Once both fields are complete, DriftBoard creates the workspace, reads the selected project source, and starts monitoring endpoint schemas and drift errors for that project.
            </span>
          </div>
        </ModalBody>
        <ModalFooter className="items-center px-6 pb-6 pt-5 sm:px-8">
          <Button variant="secondary" onClick={closeProjectSetup}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateProject}
            loading={isCreating}
            disabled={!canOpenProjectSetup || !canCreateProject || Boolean(setupStatus)}
          >
            Create project
          </Button>
        </ModalFooter>
      </Modal>
    </motion.aside>
  );
}
