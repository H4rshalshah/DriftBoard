import express, { Request, Response } from 'express';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { Resend } from 'resend';

const PORT = Number(process.env.PORT || 5000);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || FRONTEND_URL;
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'driftboard-local-demo-secret';
const EMAIL_MOCK_MODE = process.env.EMAIL_MOCK_MODE === 'true';
const TEST_EMAIL_WINDOW_MS = Number(process.env.TEST_EMAIL_WINDOW_MS || 10 * 60 * 1000);
const TEST_EMAIL_MAX_REQUESTS = Number(process.env.TEST_EMAIL_MAX_REQUESTS || 3);

type User = {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar?: string;
  passwordHash?: string;
  role: 'admin' | 'owner' | 'member' | 'viewer';
  authProvider?: 'password' | 'google' | 'github';
  resetToken?: string;
  resetTokenExpiresAt?: string;
};

type Endpoint = {
  id: string;
  projectId: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  status: 'healthy' | 'warning' | 'drifted' | 'failed' | 'disabled';
  health: number;
  responseTime: number;
  monitoringEnabled: boolean;
  frequency: string;
  currentSchema: Record<string, unknown>;
  currentSchemaVersion: number;
  schemaVersions: Array<{
    id: string;
    endpointId: string;
    version: number;
    schema: Record<string, unknown>;
    createdAt: string;
    createdBy: string;
    changelog?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt?: string;
  lastDriftAt?: string;
};

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string;
  teamId: string;
  ownerId: string;
  memberCount: number;
  endpointCount: number;
  sourceType?: 'demo' | 'folder' | 'repository' | 'github' | 'upload' | 'manual';
  sourceLabel?: string;
  monitoringStatus: 'connected' | 'monitoring' | 'disconnected' | 'error';
  monitoringStartedAt?: string;
  monitoringEndsAt?: string | null;
  monitoringDuration?: string;
  createdAt: string;
  updatedAt: string;
};

type DetectedEndpoint = {
  name?: string;
  url: string;
  method: Endpoint['method'];
  currentSchema?: Record<string, unknown>;
};

type UploadedFile = {
  id: string;
  userId: string;
  projectId: string;
  originalName: string;
  storedPath: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
};

type DriftEvent = {
  id: string;
  endpointId: string;
  endpointName: string;
  projectId: string;
  projectName: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'breaking';
  status: 'new' | 'acknowledged' | 'resolved' | 'ignored';
  detectedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  changes: Array<{ path: string; field: string; expected: unknown; actual: unknown; type?: 'added' | 'removed' | 'modified' }>;
  message: string;
};

type AppNotification = {
  id: string;
  userId: string;
  projectId: string;
  type: 'drift' | 'schema' | 'system' | 'team';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  updatedAt?: string;
  duplicateCount?: number;
};

type ApiKey = {
  id: string;
  projectId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopes: string[];
  status: 'active' | 'deprecated' | 'revoked';
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
  fullKey?: string;
};

type MonitoringLog = {
  id: string;
  userId?: string;
  projectId: string;
  endpointId: string;
  statusCode: number;
  responseTime: number;
  success: boolean;
  errorMessage?: string;
  createdAt: string;
};

type EmailOutboxMessage = {
  id: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  status: 'sent' | 'saved_to_outbox' | 'failed';
  provider: 'resend' | 'local';
  createdAt: string;
  errorMessage?: string;
};

type TeamMember = {
  id: string;
  userId?: string;
  projectId: string;
  userEmail: string;
  name?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  invitedBy?: string;
  status: 'pending' | 'active' | 'removed' | 'invited' | 'joined';
  createdAt?: string;
  updatedAt?: string;
  invitedAt?: string;
  joinedAt?: string;
  inviteLink?: string;
  invitePassword?: string;
  inviteExpiresAt?: string;
};

type TeamInvite = {
  id: string;
  token: string;
  projectId: string;
  userEmail: string;
  invitedByName: string;
  invitedByEmail: string;
  role: TeamMember['role'];
  inviteLink: string;
  invitePassword: string;
  expiresAt: string;
  createdAt: string;
};

const now = () => new Date().toISOString();
const PERMISSION_DENIED_MESSAGE = 'You do not have permission to perform this action.';

type ProjectRole = TeamMember['role'];
type ProjectPermission =
  | 'project:create'
  | 'project:update'
  | 'project:delete'
  | 'project:view'
  | 'endpoint:create'
  | 'endpoint:update'
  | 'endpoint:delete'
  | 'endpoint:view'
  | 'drift:view'
  | 'drift:update'
  | 'scan:run'
  | 'team:view'
  | 'team:invite'
  | 'team:remove'
  | 'team:role:update'
  | 'notification:view'
  | 'notification:update'
  | 'api_key:create'
  | 'api_key:view'
  | 'api_key:update'
  | 'schema:view'
  | 'schema:update'
  | 'report:view';

const projectPermissionRoles: Record<ProjectPermission, ProjectRole[]> = {
  'project:create': ['owner', 'admin'],
  'project:update': ['owner', 'admin'],
  'project:delete': ['owner'],
  'project:view': ['owner', 'admin', 'member', 'viewer'],
  'endpoint:create': ['owner', 'admin', 'member'],
  'endpoint:update': ['owner', 'admin', 'member'],
  'endpoint:delete': ['owner', 'admin', 'member'],
  'endpoint:view': ['owner', 'admin', 'member', 'viewer'],
  'drift:view': ['owner', 'admin', 'member', 'viewer'],
  'drift:update': ['owner', 'admin', 'member'],
  'scan:run': ['owner', 'admin', 'member'],
  'team:view': ['owner', 'admin', 'member', 'viewer'],
  'team:invite': ['owner', 'admin'],
  'team:remove': ['owner', 'admin'],
  'team:role:update': ['owner', 'admin'],
  'notification:view': ['owner', 'admin', 'member', 'viewer'],
  'notification:update': ['owner', 'admin'],
  'api_key:create': ['owner', 'admin'],
  'api_key:view': ['owner', 'admin'],
  'api_key:update': ['owner', 'admin'],
  'schema:view': ['owner', 'admin', 'member', 'viewer'],
  'schema:update': ['owner', 'admin', 'member'],
  'report:view': ['owner', 'admin', 'member', 'viewer'],
};

const userDataPath = path.resolve(__dirname, '..', 'data', 'users.json');
const appDataPath = path.resolve(__dirname, '..', 'data', 'app-state.json');
const uploadsRoot = path.resolve(__dirname, '..', 'data', 'uploads');

let demoUser: User = {
  id: 'user_demo',
  email: 'demo@driftboard.dev',
  username: 'demo',
  name: 'Demo User',
  passwordHash: bcrypt.hashSync('Demo1234', 10),
  role: 'owner',
  authProvider: 'password',
};

function usernameFrom(value: string) {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/(^[-._]+|[-._]+$)/g, '');
  return base || `user-${crypto.randomBytes(3).toString('hex')}`;
}

function normalizeUsername(value: unknown, fallback = '') {
  const username = typeof value === 'string' ? usernameFrom(value) : '';
  return username || usernameFrom(fallback);
}

function withUsername(user: User) {
  return {
    ...user,
    username: user.username || usernameFrom(user.email || user.name || user.id),
  };
}

function loadUsers() {
  try {
    if (!fs.existsSync(userDataPath)) return [demoUser];
    const parsed = JSON.parse(fs.readFileSync(userDataPath, 'utf8')) as User[];
    const savedUsers = Array.isArray(parsed) ? parsed.map(withUsername) : [];
    const hasDemo = savedUsers.some((user) => user.email.toLowerCase() === demoUser.email.toLowerCase());
    return hasDemo ? savedUsers : [demoUser, ...savedUsers];
  } catch (error) {
    console.warn('Could not load saved users. Falling back to demo user.', error instanceof Error ? error.message : error);
    return [demoUser];
  }
}

function saveUsers() {
  try {
    fs.mkdirSync(path.dirname(userDataPath), { recursive: true });
    fs.writeFileSync(userDataPath, JSON.stringify(users.map(withUsername), null, 2));
  } catch (error) {
    console.warn('Could not save users.', error instanceof Error ? error.message : error);
  }
}

const users: User[] = loadUsers();
demoUser = users.find((user) => user.email.toLowerCase() === demoUser.email.toLowerCase()) || users[0] || demoUser;
saveUsers();

const demoProjectTemplate = (): Project => ({
  id: 'project_demo',
  name: 'Demo Project',
  slug: 'demo-project',
  description: 'Local resume demo workspace',
  teamId: 'team_demo',
  ownerId: demoUser.id,
  memberCount: 1,
  endpointCount: 2,
  sourceType: 'demo',
  sourceLabel: 'Built-in demo data',
  monitoringStatus: 'monitoring',
  monitoringStartedAt: now(),
  monitoringEndsAt: null,
  monitoringDuration: 'all',
  createdAt: now(),
  updatedAt: now(),
});

const projects: Project[] = [
  {
    id: 'project_demo',
    name: 'Demo Project',
    slug: 'demo-project',
    description: 'Local resume demo workspace',
    teamId: 'team_demo',
    ownerId: demoUser.id,
    memberCount: 1,
    endpointCount: 2,
    sourceType: 'demo',
    sourceLabel: 'Built-in demo data',
    monitoringStatus: 'monitoring',
    monitoringStartedAt: now(),
    monitoringEndsAt: null,
    monitoringDuration: 'all',
    createdAt: now(),
    updatedAt: now(),
  },
];

const endpoints: Endpoint[] = [
  {
    id: 'endpoint_users',
    projectId: 'project_demo',
    name: 'Users API',
    url: '/api/v1/users',
    method: 'GET',
    currentSchema: { id: 'string', email: 'string', name: 'string', role: 'string' },
    status: 'drifted',
    health: 82,
    responseTime: 142,
    monitoringEnabled: true,
    frequency: '5m',
    currentSchemaVersion: 4,
    schemaVersions: [],
    createdAt: now(),
    updatedAt: now(),
    lastCheckedAt: now(),
    lastDriftAt: now(),
  },
  {
    id: 'endpoint_orders',
    projectId: 'project_demo',
    name: 'Orders API',
    url: '/api/v1/orders/:id',
    method: 'GET',
    currentSchema: { id: 'string', status: 'string', total: 'number' },
    status: 'healthy',
    health: 98,
    responseTime: 118,
    monitoringEnabled: true,
    frequency: '5m',
    currentSchemaVersion: 2,
    schemaVersions: [],
    createdAt: now(),
    updatedAt: now(),
    lastCheckedAt: now(),
  },
];

endpoints.forEach((endpoint) => {
  endpoint.schemaVersions = [
    {
      id: `${endpoint.id}_v1`,
      endpointId: endpoint.id,
      version: 1,
      schema: endpoint.currentSchema,
      createdAt: endpoint.createdAt,
      createdBy: demoUser.name,
      changelog: 'Initial schema capture',
    },
    {
      id: `${endpoint.id}_v${endpoint.currentSchemaVersion}`,
      endpointId: endpoint.id,
      version: endpoint.currentSchemaVersion,
      schema: endpoint.currentSchema,
      createdAt: endpoint.updatedAt,
      createdBy: demoUser.name,
      changelog: 'Latest observed schema',
    },
  ];
});

const driftEvents: DriftEvent[] = [
  {
    id: 'drift_1',
    endpointId: 'endpoint_users',
    endpointName: 'Users API',
    projectId: 'project_demo',
    projectName: 'Demo Project',
    severity: 'critical',
    status: 'new',
    detectedAt: now(),
    message: 'Field "email" changed from required to optional',
    changes: [{ path: 'response.email', field: 'email', expected: 'required string', actual: 'optional string' }],
  },
  {
    id: 'drift_2',
    endpointId: 'endpoint_orders',
    endpointName: 'Orders API',
    projectId: 'project_demo',
    projectName: 'Demo Project',
    severity: 'medium',
    status: 'acknowledged',
    detectedAt: now(),
    message: 'New response field "fulfillmentStatus" detected',
    changes: [{ path: 'response.fulfillmentStatus', field: 'fulfillmentStatus', expected: undefined, actual: 'string' }],
  },
];

const notifications: AppNotification[] = [
  {
    id: 'notification_demo_drift',
    userId: demoUser.id,
    projectId: 'project_demo',
    type: 'drift',
    title: 'Breaking drift detected',
    message: 'Demo Project detected a required field change on Users API.',
    read: false,
    createdAt: now(),
  },
];

const apiKeys: ApiKey[] = [];
const monitoringLogs: MonitoringLog[] = [];
const emailOutbox: EmailOutboxMessage[] = [];
const teamMembers: TeamMember[] = [
  { id: 'team_member_owner', projectId: 'project_demo', userEmail: demoUser.email, name: demoUser.name, role: 'admin', status: 'joined', joinedAt: now() },
];
const teamInvites: TeamInvite[] = [];
const notificationChannels = {
  discord: { enabled: false, webhookUrl: '' },
  email: { enabled: false, address: demoUser.email },
};
const uploadedFiles: UploadedFile[] = [];

type PersistedAppState = {
  projects?: Project[];
  endpoints?: Endpoint[];
  driftEvents?: DriftEvent[];
  notifications?: AppNotification[];
  apiKeys?: ApiKey[];
  monitoringLogs?: MonitoringLog[];
  emailOutbox?: EmailOutboxMessage[];
  teamMembers?: TeamMember[];
  teamInvites?: TeamInvite[];
  uploadedFiles?: UploadedFile[];
  notificationChannels?: typeof notificationChannels;
};

function replaceArray<T>(target: T[], next?: T[]) {
  if (!Array.isArray(next)) return;
  target.splice(0, target.length, ...next);
}

function normalizeTeamMember(member: TeamMember): TeamMember {
  const linkedUser = users.find((user) => user.email.toLowerCase() === member.userEmail.toLowerCase());
  const createdAt = member.createdAt || member.invitedAt || member.joinedAt || now();
  const status = member.status === 'joined'
    ? 'active'
    : member.status === 'invited'
    ? 'pending'
    : member.status;

  return {
    ...member,
    userId: member.userId || linkedUser?.id,
    name: member.name || linkedUser?.name,
    status,
    createdAt,
    updatedAt: member.updatedAt || createdAt,
  };
}

function ensureDemoProjectData() {
  if (!projects.some((project) => project.id === 'project_demo')) {
    projects.push(demoProjectTemplate());
  }
  if (!endpoints.some((endpoint) => endpoint.projectId === 'project_demo')) {
    endpoints.push(...[
      {
        id: 'endpoint_users',
        projectId: 'project_demo',
        name: 'Users API',
        url: '/api/v1/users',
        method: 'GET' as const,
        currentSchema: { id: 'string', email: 'string', name: 'string', role: 'string' },
        status: 'drifted' as const,
        health: 82,
        responseTime: 142,
        monitoringEnabled: true,
        frequency: '5m',
        currentSchemaVersion: 4,
        schemaVersions: [],
        createdAt: now(),
        updatedAt: now(),
        lastCheckedAt: now(),
        lastDriftAt: now(),
      },
      {
        id: 'endpoint_orders',
        projectId: 'project_demo',
        name: 'Orders API',
        url: '/api/v1/orders/:id',
        method: 'GET' as const,
        currentSchema: { id: 'string', status: 'string', total: 'number' },
        status: 'healthy' as const,
        health: 98,
        responseTime: 118,
        monitoringEnabled: true,
        frequency: '5m',
        currentSchemaVersion: 2,
        schemaVersions: [],
        createdAt: now(),
        updatedAt: now(),
        lastCheckedAt: now(),
      },
    ]);
  }
  endpoints
    .filter((endpoint) => endpoint.projectId === 'project_demo' && endpoint.schemaVersions.length === 0)
    .forEach((endpoint) => {
      endpoint.schemaVersions = [
        {
          id: `${endpoint.id}_v1`,
          endpointId: endpoint.id,
          version: 1,
          schema: endpoint.currentSchema,
          createdAt: endpoint.createdAt,
          createdBy: demoUser.name,
          changelog: 'Initial schema capture',
        },
        {
          id: `${endpoint.id}_v${endpoint.currentSchemaVersion}`,
          endpointId: endpoint.id,
          version: endpoint.currentSchemaVersion,
          schema: endpoint.currentSchema,
          createdAt: endpoint.updatedAt,
          createdBy: demoUser.name,
          changelog: 'Latest observed schema',
        },
      ];
    });
  if (!teamMembers.some((member) => member.projectId === 'project_demo')) {
    teamMembers.push({ id: 'team_member_owner', projectId: 'project_demo', userEmail: demoUser.email, name: demoUser.name, role: 'admin', status: 'joined', joinedAt: now() });
  }
}

function loadAppState() {
  try {
    if (!fs.existsSync(appDataPath)) {
      ensureDemoProjectData();
      return;
    }
    const parsed = JSON.parse(fs.readFileSync(appDataPath, 'utf8')) as PersistedAppState;
    replaceArray(projects, parsed.projects);
    replaceArray(endpoints, parsed.endpoints);
    replaceArray(driftEvents, parsed.driftEvents);
    replaceArray(notifications, parsed.notifications);
    replaceArray(apiKeys, parsed.apiKeys);
    replaceArray(monitoringLogs, parsed.monitoringLogs);
    replaceArray(emailOutbox, parsed.emailOutbox);
    replaceArray(teamMembers, parsed.teamMembers);
    teamMembers.splice(0, teamMembers.length, ...teamMembers.map(normalizeTeamMember));
    replaceArray(teamInvites, parsed.teamInvites);
    replaceArray(uploadedFiles, parsed.uploadedFiles);
    if (parsed.notificationChannels) {
      notificationChannels.discord = parsed.notificationChannels.discord || notificationChannels.discord;
      notificationChannels.email = parsed.notificationChannels.email || notificationChannels.email;
    }
    ensureDemoProjectData();
  } catch (error) {
    console.warn('Could not load saved app state. Falling back to demo state.', error instanceof Error ? error.message : error);
    ensureDemoProjectData();
  }
}

function saveAppState() {
  try {
    fs.mkdirSync(path.dirname(appDataPath), { recursive: true });
    fs.writeFileSync(appDataPath, JSON.stringify({
      projects,
      endpoints,
      driftEvents,
      notifications,
      apiKeys,
      monitoringLogs,
      emailOutbox,
      teamMembers,
      teamInvites,
      uploadedFiles,
      notificationChannels,
    } satisfies PersistedAppState, null, 2));
  } catch (error) {
    console.warn('Could not save app state.', error instanceof Error ? error.message : error);
  }
}

loadAppState();
saveAppState();

type AlertDelivery = {
  channel: 'discord' | 'email';
  target: string;
  status: string;
  provider?: string;
  message?: string;
};

type AlertContext = {
  endpoint?: Endpoint;
  driftEvent?: DriftEvent;
  changes?: DriftEvent['changes'];
  severity?: DriftEvent['severity'];
};

function notificationSignature(projectId: string, type: AppNotification['type'], title: string, message: string) {
  return [
    projectId,
    type,
    title.trim().toLowerCase(),
    message.trim().toLowerCase(),
  ].join('|');
}

function findMatchingNotification(projectId: string, type: AppNotification['type'], title: string, message: string) {
  const signature = notificationSignature(projectId, type, title, message);
  return notifications.find((notification) =>
    notificationSignature(notification.projectId, notification.type, notification.title, notification.message) === signature
  );
}

function dashboardUrl(projectId: string) {
  return `${FRONTEND_URL}/app/drift-events?projectId=${encodeURIComponent(projectId)}`;
}

function severityColor(severity?: string) {
  if (severity === 'critical' || severity === 'breaking') return 0xef4444;
  if (severity === 'high') return 0xf97316;
  if (severity === 'medium') return 0xf59e0b;
  return 0x38bdf8;
}

function inferredAlertContext(projectId: string, type: AppNotification['type'], message: string): AlertContext {
  if (type === 'system') {
    const endpoint = endpoints.find((item) => item.projectId === projectId && message.toLowerCase().includes(item.name.toLowerCase()));
    return {
      endpoint,
      severity: endpoint?.status === 'failed' ? 'high' : undefined,
    };
  }
  if (type !== 'drift') return {};
  const driftEvent = driftEvents.find((event) => event.projectId === projectId && event.message === message) || driftEvents.find((event) => event.projectId === projectId);
  const endpoint = driftEvent ? endpoints.find((item) => item.id === driftEvent.endpointId) : undefined;
  return {
    endpoint,
    driftEvent,
    changes: driftEvent?.changes,
    severity: driftEvent?.severity,
  };
}

function alertSummary(title: string, message: string, projectId: string, type: AppNotification['type'], context: AlertContext) {
  const project = projects.find((item) => item.id === projectId);
  const endpoint = context.endpoint || (context.driftEvent ? endpoints.find((item) => item.id === context.driftEvent?.endpointId) : undefined);
  const changes = context.changes || context.driftEvent?.changes || [];
  const severity = context.severity || context.driftEvent?.severity;
  const isEndpointFailure = type === 'system' && title.toLowerCase().includes('endpoint failed');
  const driftKind = isEndpointFailure
    ? 'Endpoint request failure'
    : changes.length
    ? [...new Set(changes.map((change) => change.type || 'modified'))].join(', ')
    : type;
  const changedFields = changes.length
    ? changes.slice(0, 8).map((change) => `${change.type || 'modified'}: ${change.path || change.field}`).join('\n')
    : isEndpointFailure
    ? 'The endpoint request failed before schema comparison could run.'
    : 'No field-level change details were attached.';

  return {
    project,
    endpoint,
    driftEvent: context.driftEvent,
    changes,
    severity,
    driftKind,
    changedFields,
    subject: `[DriftBoard] ${title}${project ? ` - ${project.name}` : ''}`,
    title,
    message,
    url: dashboardUrl(projectId),
    detectedAt: context.driftEvent?.detectedAt || now(),
  };
}

function htmlEscape(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function emailConfigStatus() {
  const missing = [
    ['RESEND_API_KEY', process.env.RESEND_API_KEY],
    ['ALERT_FROM_EMAIL', process.env.ALERT_FROM_EMAIL],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    configured: missing.length === 0,
    mockMode: EMAIL_MOCK_MODE,
    missing,
    message: missing.length === 0
      ? 'Email notifications active'
      : `Email notifications are not configured. Missing ${missing.join(', ')}.`,
  };
}

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  tag: 'drift_alert' | 'team_invitation' | 'test_alert';
};

async function sendEmailWithResend(input: SendEmailInput): Promise<AlertDelivery> {
  const to = input.to.trim().toLowerCase();
  if (!isValidEmailAddress(to)) {
    console.warn('Invalid email recipient', { to, tag: input.tag });
    throw new Error('Invalid recipient email address.');
  }

  const status = emailConfigStatus();
  if (!status.configured) {
    console.warn('Missing email configuration', { missing: status.missing, tag: input.tag });
    if (EMAIL_MOCK_MODE) {
      console.info('Email mock mode enabled', { to, subject: input.subject, tag: input.tag });
      return {
        channel: 'email',
        target: to,
        status: 'mock_sent',
        provider: 'mock',
        message: 'Email mock mode is enabled. No real email was sent.',
      };
    }
    throw new Error(status.message);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const payload = {
    from: process.env.ALERT_FROM_EMAIL!,
    to,
    replyTo: process.env.ALERT_REPLY_TO || undefined,
    subject: input.subject,
    html: input.html,
    text: input.text,
  };

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await resend.emails.send(payload);
      const errorMessage = result.error?.message;
      if (errorMessage) {
        throw new Error(errorMessage);
      }
      emailOutbox.unshift({
        id: uuidv4(),
        to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        status: 'sent',
        provider: 'resend',
        createdAt: now(),
      });
      saveAppState();
      console.info('Email sent successfully', { to, tag: input.tag, provider: 'resend', emailId: result.data?.id });
      return { channel: 'email', target: to, status: 'sent', provider: 'resend' };
    } catch (error) {
      lastError = error;
      console.error('Email failed', {
        to,
        tag: input.tag,
        attempt,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  emailOutbox.unshift({
    id: uuidv4(),
    to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    status: 'failed',
    provider: 'resend',
    createdAt: now(),
    errorMessage: lastError instanceof Error ? lastError.message : 'Email delivery failed',
  });
  saveAppState();
  throw new Error(lastError instanceof Error ? lastError.message : 'Email delivery failed');
}

function emailShell(title: string, eyebrow: string, body: string, buttonUrl: string, buttonText: string) {
  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${htmlEscape(title)}</title>
  </head>
  <body style="margin:0;background:#080b12;color:#e5edf8;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#080b12;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border:1px solid #253044;border-radius:18px;overflow:hidden;background:#101522;">
            <tr>
              <td style="padding:28px 28px 18px;background:#121a2a;border-bottom:1px solid #253044;">
                <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#7dd3fc;font-weight:800;">DriftBoard</div>
                <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;color:#ffffff;">${htmlEscape(title)}</h1>
                <p style="margin:10px 0 0;color:#94a3b8;font-size:14px;">${htmlEscape(eyebrow)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                ${body}
                <div style="margin-top:28px;">
                  <a href="${htmlEscape(buttonUrl)}" style="display:inline-block;background:#38bdf8;color:#06111f;text-decoration:none;font-weight:800;border-radius:10px;padding:13px 18px;">${htmlEscape(buttonText)}</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;border-top:1px solid #253044;color:#64748b;font-size:12px;background:#0d1320;">
                Sent by DriftBoard. Manage notification preferences in Settings.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function detailRows(rows: Array<[string, unknown]>) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#0b1020;border:1px solid #253044;border-radius:12px;overflow:hidden;">
      ${rows.map(([label, value]) => `
        <tr>
          <td style="padding:12px 14px;color:#94a3b8;font-size:13px;border-bottom:1px solid #1f2937;width:38%;">${htmlEscape(label)}</td>
          <td style="padding:12px 14px;color:#f8fafc;font-size:14px;border-bottom:1px solid #1f2937;font-weight:700;">${htmlEscape(value)}</td>
        </tr>
      `).join('')}
    </table>`;
}

async function sendDriftAlertEmail(to: string, summary: ReturnType<typeof alertSummary>) {
  const endpointLabel = summary.endpoint ? `${summary.endpoint.method} ${summary.endpoint.name || summary.endpoint.url}` : summary.driftEvent?.endpointName || 'Project event';
  const html = emailShell(
    'API drift detected',
    'A monitored contract changed and may need review.',
    `
      ${detailRows([
        ['Project', summary.project?.name || 'Unknown project'],
        ['Endpoint', endpointLabel],
        ['HTTP method', summary.endpoint?.method || 'N/A'],
        ['Drift type', summary.driftKind],
        ['Severity', String(summary.severity || 'drift').toUpperCase()],
        ['Timestamp', new Date(summary.detectedAt).toLocaleString()],
      ])}
      <div style="margin-top:18px;padding:14px;border-radius:12px;background:#111827;border:1px solid #253044;">
        <div style="color:#94a3b8;font-size:13px;font-weight:700;margin-bottom:8px;">Changed fields</div>
        <pre style="white-space:pre-wrap;margin:0;color:#dbeafe;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.6;">${htmlEscape(summary.changedFields)}</pre>
      </div>
    `,
    summary.url,
    'View Drift'
  );
  const text = [
    summary.subject,
    summary.message,
    '',
    `Project: ${summary.project?.name || 'Unknown project'}`,
    `Endpoint: ${endpointLabel}`,
    `HTTP method: ${summary.endpoint?.method || 'N/A'}`,
    `Drift type: ${summary.driftKind}`,
    `Severity: ${String(summary.severity || 'drift').toUpperCase()}`,
    `Timestamp: ${new Date(summary.detectedAt).toLocaleString()}`,
    '',
    summary.changedFields,
    '',
    `View Drift: ${summary.url}`,
  ].join('\n');

  return sendEmailWithResend({ to, subject: summary.subject, html, text, tag: 'drift_alert' });
}

async function sendInvitationEmail(to: string, invite: TeamInvite, projectName: string) {
  const html = emailShell(
    `Join ${projectName} on DriftBoard`,
    `${invite.invitedByName} invited you as ${invite.role}.`,
    `
      ${detailRows([
        ['Inviter', `${invite.invitedByName} <${invite.invitedByEmail}>`],
        ['Workspace', projectName],
        ['Assigned role', invite.role],
        ['Login code', invite.invitePassword],
        ['Expires', new Date(invite.expiresAt).toLocaleString()],
      ])}
      <p style="margin:18px 0 0;color:#cbd5e1;font-size:14px;line-height:1.7;">Open the invite, then enter the login code shown above to activate project access.</p>
    `,
    invite.inviteLink,
    'Accept invitation'
  );
  const text = [
    `${invite.invitedByName} invited you to ${projectName} on DriftBoard.`,
    `Role: ${invite.role}`,
    `Login code: ${invite.invitePassword}`,
    `Accept invitation: ${invite.inviteLink}`,
  ].join('\n');

  return sendEmailWithResend({
    to,
    subject: `DriftBoard invitation to ${projectName}`,
    html,
    text,
    tag: 'team_invitation',
  });
}

async function sendTestAlertEmail(to: string, summary: ReturnType<typeof alertSummary>) {
  return sendEmailWithResend({
    to,
    subject: '[DriftBoard] Test alert',
    html: emailShell(
      'Test alert delivered',
      'Your DriftBoard email notification channel is working.',
      detailRows([
        ['Project', summary.project?.name || 'Demo Project'],
        ['Endpoint', summary.endpoint ? `${summary.endpoint.method} ${summary.endpoint.name || summary.endpoint.url}` : 'Checkout API'],
        ['Severity', 'TEST'],
        ['Timestamp', new Date().toLocaleString()],
      ]),
      summary.url,
      'Open DriftBoard'
    ),
    text: `Your DriftBoard test alert was delivered.\n\nOpen DriftBoard: ${summary.url}`,
    tag: 'test_alert',
  });
}

async function sendDiscordAlert(title: string, message: string, projectId: string, type: AppNotification['type'], context: AlertContext): Promise<AlertDelivery> {
  const summary = alertSummary(title, message, projectId, type, context);
  await axios.post(notificationChannels.discord.webhookUrl, {
    username: 'DriftBoard',
    avatar_url: `${FRONTEND_URL}/driftboard.svg`,
    embeds: [
      {
        title: summary.title,
        description: summary.message,
        color: severityColor(summary.severity),
        url: summary.url,
        timestamp: summary.detectedAt,
        footer: { text: 'DriftBoard Contract Radar' },
        fields: [
          { name: 'Project', value: summary.project?.name || 'Unknown project', inline: true },
          { name: 'Endpoint', value: summary.endpoint ? `${summary.endpoint.method} ${summary.endpoint.url}` : summary.driftEvent?.endpointName || 'Project event', inline: true },
          { name: 'Severity', value: String(summary.severity || type).toUpperCase(), inline: true },
          { name: 'Drift type', value: summary.driftKind, inline: true },
          { name: 'Changed fields', value: summary.changedFields.slice(0, 1000), inline: false },
          { name: 'Open in DriftBoard', value: summary.url, inline: false },
        ],
      },
    ],
  });
  return { channel: 'discord', target: notificationChannels.discord.webhookUrl, status: 'sent' };
}

async function sendEmailAlert(title: string, message: string, projectId: string, type: AppNotification['type'], context: AlertContext): Promise<AlertDelivery> {
  const summary = alertSummary(title, message, projectId, type, context);
  const to = notificationChannels.email.address;
  return sendDriftAlertEmail(to, summary);
}

async function deliverConfiguredAlert(title: string, message: string, projectId: string, type: AppNotification['type'], alertContext?: AlertContext) {
  const context = alertContext || inferredAlertContext(projectId, type, message);

  if (notificationChannels.discord.enabled && notificationChannels.discord.webhookUrl) {
    try {
      await sendDiscordAlert(title, message, projectId, type, context);
    } catch (error) {
      console.error('Discord alert failed:', error instanceof Error ? error.message : error);
    }
  }

  if (notificationChannels.email.enabled && notificationChannels.email.address) {
    try {
      await sendEmailAlert(title, message, projectId, type, context);
    } catch (error) {
      emailOutbox.unshift({
        id: uuidv4(),
        to: notificationChannels.email.address,
        subject: `[DriftBoard] ${title}`,
        text: message,
        html: htmlEscape(message),
        status: 'failed',
        provider: process.env.RESEND_API_KEY ? 'resend' : 'local',
        createdAt: now(),
        errorMessage: error instanceof Error ? error.message : 'Email delivery failed',
      });
      saveAppState();
      console.error('Email alert failed:', error instanceof Error ? error.message : error);
    }
  }
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    credentials: true,
  },
});

app.use(helmet());
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(
  '/api',
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
    max: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 500),
    standardHeaders: true,
    legacyHeaders: false,
  })
);
const testEmailLimiter = rateLimit({
  windowMs: TEST_EMAIL_WINDOW_MS,
  max: TEST_EMAIL_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many test alerts. Please wait before sending another one.' },
});
app.use('/api', (req, res, next) => {
  res.on('finish', () => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && res.statusCode < 500) {
      saveAppState();
    }
  });
  next();
});

function issueToken(user: User) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

function getRequestUser(req: Request, allowFallback = true) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { sub?: string; email?: string };
      const user = users.find((item) => item.id === payload.sub || item.email.toLowerCase() === payload.email?.toLowerCase());
      if (user) return user;
    } catch {
      return null;
    }
  }
  return allowFallback ? demoUser : null;
}

function requireRequestUser(req: Request, res: Response) {
  const user = getRequestUser(req, false);
  if (!user) {
    res.status(401).json({ message: 'Please sign in again.' });
    return null;
  }
  return user;
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeIdentifier(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function findUserByIdentifier(identifier: string) {
  const normalized = identifier.toLowerCase();
  return users.find(
    (user) =>
      user.email.toLowerCase() === normalized ||
      user.username.toLowerCase() === normalized
  );
}

function findUserByEmail(email: string) {
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

function isUsernameTaken(username: string, userId?: string) {
  return users.some((user) => user.username.toLowerCase() === username.toLowerCase() && user.id !== userId);
}

function isEmailTaken(email: string, userId?: string) {
  return users.some((user) => user.email.toLowerCase() === email.toLowerCase() && user.id !== userId);
}

function setActiveUser(user: User) {
  demoUser = withUsername(user);
  notificationChannels.email.address = user.email;
  syncUserMembership(demoUser);
  saveUsers();
  return demoUser;
}

function updateUser(userId: string, nextFields: Partial<User>) {
  const existing = users.find((user) => user.id === userId);
  if (!existing) return null;
  const updated = upsertUser({ ...existing, ...nextFields });
  if (demoUser.id === updated.id) {
    demoUser = updated;
  }
  return updated;
}

function upsertUser(nextUser: User) {
  const preparedUser = withUsername(nextUser);
  const existingIndex = users.findIndex((user) => user.email.toLowerCase() === nextUser.email.toLowerCase());
  if (existingIndex >= 0) {
    users[existingIndex] = withUsername({ ...users[existingIndex], ...preparedUser });
    saveUsers();
    return users[existingIndex];
  }
  users.push(preparedUser);
  saveUsers();
  return preparedUser;
}

function sendLoginResponse(req: Request, res: Response) {
  const identifier = normalizeIdentifier(req.body?.identifier || req.body?.email || req.body?.username);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!identifier || !password) {
    res.status(400).json({ message: 'Email or username and password are required' });
    return;
  }

  const user = findUserByIdentifier(identifier);

  if (!user || !user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
    res.status(401).json({ message: 'Invalid email, username, or password.' });
    return;
  }

  setActiveUser(user);
  res.json({ user: publicUser(user), token: issueToken(user) });
}

function sendRegisterResponse(req: Request, res: Response) {
  const email = normalizeEmail(req.body?.email);
  const username = normalizeUsername(req.body?.username, email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const name = typeof req.body?.name === 'string'
    ? req.body.name.trim()
    : email.split('@')[0]?.replace(/[._-]/g, ' ') || demoUser.name;

  if (!email || !password || password.length < 8 || !name) {
    res.status(400).json({ message: 'Name, email, and a password of at least 8 characters are required' });
    return;
  }

  const existingUser = findUserByEmail(email);
  if (existingUser?.passwordHash) {
    res.status(409).json({ message: 'An account already exists for this email. Sign in instead.' });
    return;
  }

  if (isUsernameTaken(username, existingUser?.id)) {
    res.status(409).json({ message: 'That username is already taken.' });
    return;
  }

  const user = upsertUser({
    id: existingUser?.id || uuidv4(),
    email,
    username,
    name,
    passwordHash: bcrypt.hashSync(password, 10),
    role: existingUser?.role || 'owner',
    authProvider: 'password',
  });
  setActiveUser(user);
  res.status(existingUser ? 200 : 201).json({ user: publicUser(user), token: issueToken(user) });
}

function sendForgotPasswordResponse(req: Request, res: Response) {
  const identifier = normalizeIdentifier(req.body?.identifier || req.body?.email || req.body?.username);

  if (!identifier) {
    res.status(400).json({ message: 'Email or username is required' });
    return;
  }

  const user = findUserByIdentifier(identifier);
  if (!user) {
    res.status(404).json({ message: 'No account found for this email or username.' });
    return;
  }

  const resetToken = crypto.randomBytes(16).toString('hex');
  user.resetToken = resetToken;
  user.resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  saveUsers();

  res.json({
    message: 'Password reset is ready. Use the reset code below to set a new password.',
    resetToken,
    expiresAt: user.resetTokenExpiresAt,
  });
}

function sendResetPasswordResponse(req: Request, res: Response) {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (!token || !newPassword || newPassword.length < 8) {
    res.status(400).json({ message: 'Reset code and a new password of at least 8 characters are required' });
    return;
  }

  const user = users.find((item) => item.resetToken === token);
  if (!user || !user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt).getTime() < Date.now()) {
    res.status(400).json({ message: 'Reset code is invalid or expired. Request a new code.' });
    return;
  }

  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  user.authProvider = 'password';
  user.resetToken = undefined;
  user.resetTokenExpiresAt = undefined;
  saveUsers();
  setActiveUser(user);

  res.json({ user: publicUser(user), token: issueToken(user), message: 'Password reset successful' });
}

function sendSocialLoginResponse(req: Request, res: Response) {
  const provider = req.body?.provider === 'github' ? 'github' : req.body?.provider === 'google' ? 'google' : '';
  const email = normalizeEmail(req.body?.email);
  const username = normalizeUsername(req.body?.username, email);
  const fallbackName = provider === 'github' ? 'GitHub User' : 'Google User';
  const name = typeof req.body?.name === 'string' && req.body.name.trim()
    ? req.body.name.trim()
    : email.split('@')[0]?.replace(/[._-]/g, ' ') || fallbackName;

  if (!provider) {
    res.status(400).json({ message: 'Provider must be google or github' });
    return;
  }

  if (!email) {
    res.status(400).json({ message: `Enter the email connected to your ${provider} account.` });
    return;
  }

  const existingUser = findUserByEmail(email);
  const user = upsertUser({
    ...(existingUser || {}),
    id: existingUser?.id || uuidv4(),
    email,
    username: isUsernameTaken(username, existingUser?.id) ? usernameFrom(`${provider}-${crypto.randomBytes(3).toString('hex')}`) : username,
    name: existingUser?.name || name,
    role: existingUser?.role || 'owner',
    authProvider: provider,
  } as User);

  setActiveUser(user);
  res.json({ user: publicUser(user), token: issueToken(user), message: `Signed in with ${provider}` });
}

type OAuthProvider = 'google' | 'github';

function oauthRedirectUri(provider: OAuthProvider) {
  return `${BACKEND_URL}/api/auth/oauth/${provider}/callback`;
}

function redirectWithAuthError(res: Response, message: string) {
  res.redirect(`${FRONTEND_URL}/login?authError=${encodeURIComponent(message)}`);
}

function redirectWithAuthSuccess(res: Response, user: User) {
  const token = issueToken(user);
  const encodedUser = Buffer.from(JSON.stringify(publicUser(user))).toString('base64url');
  res.redirect(`${FRONTEND_URL}/login?oauth=success&token=${encodeURIComponent(token)}&user=${encodeURIComponent(encodedUser)}`);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`OAuth request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function getOAuthConfig(provider: OAuthProvider) {
  if (provider === 'google') {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
    };
  }

  return {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
  };
}

function upsertOAuthUser(provider: OAuthProvider, email: string, name: string, avatar?: string) {
  const existingUser = findUserByEmail(email);
  const username = existingUser?.username || usernameFrom(email);
  const user = upsertUser({
    ...(existingUser || {}),
    id: existingUser?.id || uuidv4(),
    email,
    username: isUsernameTaken(username, existingUser?.id) ? usernameFrom(`${provider}-${crypto.randomBytes(3).toString('hex')}`) : username,
    name: existingUser?.name || name || usernameFrom(email),
    avatar: existingUser?.avatar || avatar,
    role: existingUser?.role || 'owner',
    authProvider: provider,
    passwordHash: existingUser?.passwordHash,
  } as User);
  return setActiveUser(user);
}

async function completeGoogleOAuth(code: string) {
  const config = getOAuthConfig('google');
  const tokenResponse = await fetchJson<{ access_token: string }>(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: oauthRedirectUri('google'),
      grant_type: 'authorization_code',
    }),
  });
  const profile = await fetchJson<{ email?: string; name?: string; picture?: string }>('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
  });
  if (!profile.email) throw new Error('Google did not return an email address');
  return upsertOAuthUser('google', profile.email.toLowerCase(), profile.name || usernameFrom(profile.email), profile.picture);
}

async function completeGitHubOAuth(code: string) {
  const config = getOAuthConfig('github');
  const tokenResponse = await fetchJson<{ access_token: string }>(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: oauthRedirectUri('github'),
    }),
  });
  const profile = await fetchJson<{ login: string; name?: string; email?: string; avatar_url?: string }>('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenResponse.access_token}`, Accept: 'application/vnd.github+json' },
  });
  let email = profile.email || '';
  if (!email) {
    const emails = await fetchJson<Array<{ email: string; primary: boolean; verified: boolean }>>('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}`, Accept: 'application/vnd.github+json' },
    });
    email = emails.find((item) => item.primary && item.verified)?.email || emails.find((item) => item.verified)?.email || '';
  }
  if (!email) throw new Error('GitHub did not return a verified email address');
  return upsertOAuthUser('github', email.toLowerCase(), profile.name || profile.login, profile.avatar_url);
}

function publicUser(user = demoUser) {
  const {
    passwordHash: _passwordHash,
    resetToken: _resetToken,
    resetTokenExpiresAt: _resetTokenExpiresAt,
    ...safeUser
  } = user;
  return safeUser;
}

function updateActiveUser(nextFields: Partial<User>) {
  const updated = updateUser(demoUser.id, nextFields) || upsertUser({ ...demoUser, ...nextFields });
  return updated;
}

function syncUserMembership(user: User) {
  teamMembers
    .filter((member) => member.userEmail.toLowerCase() === user.email.toLowerCase())
    .forEach((member) => {
      member.name = user.name;
    });
}

function syncUserMembershipAfterProfileChange(previousEmail: string, user: User) {
  teamMembers
    .filter((member) => member.userEmail.toLowerCase() === previousEmail.toLowerCase())
    .forEach((member) => {
      member.userEmail = user.email;
      member.name = user.name;
    });
}

function syncDemoUserMembership() {
  syncUserMembership(demoUser);
}

function userForEmail(email: string) {
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

function generateInvitePassword() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function createInviteLink(token: string) {
  return `${PUBLIC_APP_URL.replace(/\/$/, '')}/invite/${token}`;
}

function ensureProjectAdmin(projectId: string, user = demoUser) {
  const existing = teamMembers.find(
    (member) => member.projectId === projectId && member.userEmail.toLowerCase() === user.email.toLowerCase()
  );
  const project = projects.find((item) => item.id === projectId);
  const role: ProjectRole = project?.ownerId === user.id ? 'owner' : 'admin';
  const timestamp = now();
  if (existing) {
    existing.userId = user.id;
    existing.name = user.name;
    existing.status = 'active';
    existing.joinedAt = existing.joinedAt || timestamp;
    existing.createdAt = existing.createdAt || timestamp;
    existing.updatedAt = timestamp;
    existing.role = role;
    return existing;
  }

  const admin: TeamMember = {
    id: uuidv4(),
    userId: user.id,
    projectId,
    userEmail: user.email,
    name: user.name,
    role,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    joinedAt: timestamp,
  };
  teamMembers.unshift(admin);
  return admin;
}

function ensureProjectOwner(projectId: string) {
  const project = projects.find((item) => item.id === projectId);
  const owner = users.find((user) => user.id === project?.ownerId) || demoUser;
  return ensureProjectAdmin(projectId, owner);
}

function projectMemberForUser(projectId: string, user: User) {
  return teamMembers.find((member) =>
    member.projectId === projectId &&
    member.status !== 'removed' &&
    (member.userId === user.id || member.userEmail.toLowerCase() === user.email.toLowerCase())
  );
}

function projectRole(projectId: string, user: User): ProjectRole | null {
  if (projectId === 'project_demo') return 'viewer';
  const project = projects.find((item) => item.id === projectId);
  if (project?.ownerId === user.id) return 'owner';
  const member = projectMemberForUser(projectId, user);
  if (!member || member.status !== 'active') return null;
  return member.role === 'owner' ? 'admin' : member.role;
}

function userHasProjectPermission(projectId: string, user: User, permission: ProjectPermission) {
  const role = projectRole(projectId, user);
  return Boolean(role && projectPermissionRoles[permission].includes(role));
}

function projectForUser(project: Project, user: User) {
  return {
    ...project,
    currentUserRole: projectRole(project.id, user),
    currentUserPermissions: projectRole(project.id, user)
      ? Object.fromEntries(
          Object.keys(projectPermissionRoles).map((permission) => [
            permission,
            userHasProjectPermission(project.id, user, permission as ProjectPermission),
          ])
        )
      : {},
  };
}

function deny(res: Response) {
  res.status(403).json({ message: PERMISSION_DENIED_MESSAGE });
}

function requireProjectPermission(req: Request, res: Response, projectId: string, permission: ProjectPermission) {
  const user = requireRequestUser(req, res);
  if (!user) return null;
  const project = projects.find((item) => item.id === projectId);
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return null;
  }
  if (!userHasProjectPermission(projectId, user, permission)) {
    deny(res);
    return null;
  }
  return user;
}

function requireAccountProjectCreate(req: Request, res: Response) {
  const user = requireRequestUser(req, res);
  if (!user) return null;
  if (!['owner', 'admin'].includes(user.role)) {
    deny(res);
    return null;
  }
  return user;
}

function visibleProjectsForUser(user: User) {
  projects.forEach((project) => ensureProjectOwner(project.id));
  const visible = projects.filter((project) => Boolean(projectRole(project.id, user)));
  const demoProject = projects.find((project) => project.id === 'project_demo');
  const visibleWithRole = visible.map((project) => projectForUser(project, user));
  return demoProject && !visibleWithRole.some((project) => project.id === demoProject.id)
    ? [projectForUser(demoProject, user), ...visibleWithRole]
    : visibleWithRole;
}

function requireProjectEditor(req: Request, res: Response, projectId: string) {
  return requireProjectPermission(req, res, projectId, 'endpoint:update');
}

function requireProjectAdmin(req: Request, res: Response, projectId: string) {
  return requireProjectPermission(req, res, projectId, 'team:invite');
}

function projectAdmins(projectId: string, excludeMemberId?: string) {
  return teamMembers.filter(
    (member) => member.projectId === projectId && member.id !== excludeMemberId && ['owner', 'admin'].includes(member.role) && member.status !== 'removed'
  );
}

function endpointProjectId(endpointId: string) {
  return endpoints.find((endpoint) => endpoint.id === endpointId)?.projectId || null;
}

function schemaVersionProjectId(versionId: string) {
  return endpoints.find((endpoint) => endpoint.schemaVersions.some((version) => version.id === versionId))?.projectId || null;
}

function driftProjectId(driftId: string) {
  return driftEvents.find((event) => event.id === driftId)?.projectId || null;
}

function apiKeyProjectId(apiKeyId: string) {
  return apiKeys.find((key) => key.id === apiKeyId)?.projectId || null;
}

function slugifyProjectName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `project-${Date.now()}`;
}

function endpointName(method: string, url: string) {
  const readablePath = url
    .replace(/^\/api\/?/i, '')
    .replace(/[:{}]/g, '')
    .split('/')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return `${method.toUpperCase()} ${readablePath || 'Root'}`;
}

function createEndpointFromDetection(projectId: string, detected: DetectedEndpoint): Endpoint {
  const createdAt = now();
  const currentSchema = detected.currentSchema || {
    status: 'string',
    data: 'object',
  };
  const endpoint: Endpoint = {
    id: uuidv4(),
    projectId,
    name: detected.name || endpointName(detected.method, detected.url),
    url: detected.url,
    method: detected.method,
    status: 'healthy',
    health: 100,
    responseTime: 0,
    monitoringEnabled: true,
    frequency: '5m',
    currentSchema,
    currentSchemaVersion: 1,
    schemaVersions: [],
    createdAt,
    updatedAt: createdAt,
    lastCheckedAt: createdAt,
  };

  endpoint.schemaVersions.push({
    id: uuidv4(),
    endpointId: endpoint.id,
    version: 1,
    schema: currentSchema,
    createdAt,
    createdBy: 'Project scanner',
    changelog: 'Initial schema snapshot from project setup',
  });

  return endpoint;
}

function removeProjectData(projectId: string) {
  for (let index = projects.length - 1; index >= 0; index -= 1) {
    if (projects[index].id === projectId) projects.splice(index, 1);
  }
  for (let index = endpoints.length - 1; index >= 0; index -= 1) {
    if (endpoints[index].projectId === projectId) endpoints.splice(index, 1);
  }
  for (let index = driftEvents.length - 1; index >= 0; index -= 1) {
    if (driftEvents[index].projectId === projectId) driftEvents.splice(index, 1);
  }
  for (let index = notifications.length - 1; index >= 0; index -= 1) {
    if (notifications[index].projectId === projectId) notifications.splice(index, 1);
  }
  for (let index = apiKeys.length - 1; index >= 0; index -= 1) {
    if (apiKeys[index].projectId === projectId) apiKeys.splice(index, 1);
  }
  for (let index = monitoringLogs.length - 1; index >= 0; index -= 1) {
    if (monitoringLogs[index].projectId === projectId) monitoringLogs.splice(index, 1);
  }
  for (let index = uploadedFiles.length - 1; index >= 0; index -= 1) {
    if (uploadedFiles[index].projectId === projectId) uploadedFiles.splice(index, 1);
  }
  for (let index = teamMembers.length - 1; index >= 0; index -= 1) {
    if (teamMembers[index].projectId === projectId) teamMembers.splice(index, 1);
  }
}

function buildUploadedFiles(userId: string, projectId: string, rawFiles: unknown, fallbackName: string, fallbackCount: number): UploadedFile[] {
  fs.mkdirSync(path.join(uploadsRoot, projectId), { recursive: true });
  const files = Array.isArray(rawFiles) ? rawFiles : [];
  if (files.length === 0 && fallbackCount > 0) {
    return [{
      id: uuidv4(),
      userId,
      projectId,
      originalName: fallbackName || 'Uploaded project folder',
      storedPath: path.join(uploadsRoot, projectId, 'project-source-metadata.json'),
      fileType: 'folder',
      fileSize: 0,
      uploadedAt: now(),
    }];
  }

  return files
    .map((file): UploadedFile | null => {
      if (!file || typeof file !== 'object') return null;
      const item = file as Record<string, unknown>;
      const originalName = String(item.originalName || item.name || '').trim();
      if (!originalName) return null;
      return {
        id: uuidv4(),
        userId,
        projectId,
        originalName,
        storedPath: path.join(uploadsRoot, projectId, originalName.replace(/[\\/:*?"<>|]+/g, '_')),
        fileType: String(item.fileType || item.type || path.extname(originalName).replace(/^\./, '') || 'file'),
        fileSize: Number(item.fileSize || item.size || 0),
        uploadedAt: now(),
      };
    })
    .filter((file): file is UploadedFile => Boolean(file));
}

function normalizeSourceType(sourceType: unknown): Project['sourceType'] {
  if (sourceType === 'repository' || sourceType === 'github') return 'github';
  if (sourceType === 'manual') return 'manual';
  if (sourceType === 'upload' || sourceType === 'folder') return 'upload';
  return 'upload';
}

function parseMonitoringDuration(duration: unknown) {
  const value = String(duration || 'all').trim().toLowerCase();
  if (!value || ['all', 'always', 'continuous', 'forever'].includes(value)) {
    return { label: 'all', endsAt: null as string | null };
  }

  const match = value.match(/^(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/);
  if (!match) {
    return { label: 'all', endsAt: null as string | null };
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit.startsWith('m')
    ? 60 * 1000
    : unit.startsWith('h')
    ? 60 * 60 * 1000
    : 24 * 60 * 60 * 1000;

  return {
    label: `${amount}${unit.startsWith('m') ? 'm' : unit.startsWith('h') ? 'h' : 'd'}`,
    endsAt: new Date(Date.now() + amount * multiplier).toISOString(),
  };
}

function expireProjectMonitoring(project: Project) {
  if (
    project.monitoringStatus === 'monitoring' &&
    project.monitoringEndsAt &&
    new Date(project.monitoringEndsAt).getTime() <= Date.now()
  ) {
    project.monitoringStatus = 'disconnected';
    project.updatedAt = now();
    endpoints
      .filter((endpoint) => endpoint.projectId === project.id)
      .forEach((endpoint) => {
        endpoint.monitoringEnabled = false;
        endpoint.status = 'disabled';
        endpoint.updatedAt = project.updatedAt;
      });
    createNotification(project.id, 'system', 'Monitoring time ended', `${project.name} monitoring is disconnected. Start monitoring again to resume checks.`, false);
    io.emit('project:monitoring-ended', { projectId: project.id, endedAt: project.updatedAt });
  }
  return project;
}

function refreshMonitoringStatuses() {
  projects.forEach(expireProjectMonitoring);
}

function startProjectMonitoring(project: Project, duration: unknown) {
  const parsed = parseMonitoringDuration(duration);
  const startedAt = now();
  project.monitoringStatus = 'monitoring';
  project.monitoringStartedAt = startedAt;
  project.monitoringEndsAt = parsed.endsAt;
  project.monitoringDuration = parsed.label;
  project.updatedAt = startedAt;
  endpoints
    .filter((endpoint) => endpoint.projectId === project.id)
    .forEach((endpoint) => {
      endpoint.monitoringEnabled = true;
      if (endpoint.status === 'disabled') endpoint.status = 'healthy';
      endpoint.updatedAt = startedAt;
    });
  return project;
}

function liveProjectIds(userId?: string) {
  return projects
    .filter((project) => project.id !== 'project_demo')
    .filter((project) => !userId || project.ownerId === userId)
    .map((project) => project.id);
}

function clearLiveProject(reason = 'Project disconnected', userId?: string) {
  const ids = liveProjectIds(userId);
  if (ids.length === 0) return;

  const disconnectedAt = now();
  projects
    .filter((project) => ids.includes(project.id))
    .forEach((project) => {
      project.monitoringStatus = 'disconnected';
      project.monitoringEndsAt = null;
      project.updatedAt = disconnectedAt;
    });
  endpoints
    .filter((endpoint) => ids.includes(endpoint.projectId))
    .forEach((endpoint) => {
      endpoint.monitoringEnabled = false;
      endpoint.status = 'disabled';
      endpoint.updatedAt = disconnectedAt;
    });

  io.emit('project:disconnected', { projectIds: ids, reason, disconnectedAt });
}

function createNotification(projectId: string, type: AppNotification['type'], title: string, message: string, sendExternalAlert = true, alertContext?: AlertContext) {
  const project = projects.find((item) => item.id === projectId);
  const existing = findMatchingNotification(projectId, type, title, message);
  if (existing) {
    existing.updatedAt = now();
    existing.duplicateCount = (existing.duplicateCount || 1) + 1;
    saveAppState();
    return existing;
  }

  const notification: AppNotification = {
    id: uuidv4(),
    userId: project?.ownerId || demoUser.id,
    projectId,
    type,
    title,
    message,
    read: false,
    createdAt: now(),
  };
  notifications.unshift(notification);
  io.emit('notification:new', notification);
  if (sendExternalAlert && shouldDeliverExternalNotification(projectId, type, title)) {
    void deliverConfiguredAlert(title, message, projectId, type, alertContext);
  }
  saveAppState();
  return notification;
}

function shouldDeliverExternalNotification(projectId: string, type: AppNotification['type'], title: string) {
  if (projectId === 'project_demo') return false;
  if (type === 'drift') return true;
  return type === 'system' && title.toLowerCase() === 'endpoint failed';
}

function endpointFailureSignature(endpoint: Endpoint, reason: string) {
  return [
    endpoint.projectId,
    endpoint.id,
    endpoint.method,
    endpoint.url,
    reason.trim().toLowerCase().slice(0, 220),
  ].join('|');
}

function createEndpointFailureIncident(endpoint: Endpoint, reason: string, source: 'baseline' | 'refresh' | 'monitoring' = 'monitoring') {
  const signature = endpointFailureSignature(endpoint, reason);
  const active = activeEndpointFailures.get(endpoint.id);
  const nowMs = Date.now();

  if (active?.signature === signature) {
    return notifications.find((notification) => notification.id === active.notificationId) || null;
  }

  const shouldSendExternal = !active || nowMs - active.alertedAt >= EXTERNAL_ALERT_COOLDOWN_MS;
  const notification = createNotification(
    endpoint.projectId,
    'system',
    'Endpoint Failed',
    endpointFailureMessage(endpoint, reason, source),
    shouldSendExternal,
    { endpoint, severity: 'high' }
  );
  activeEndpointFailures.set(endpoint.id, { signature, notificationId: notification.id, alertedAt: shouldSendExternal ? nowMs : active?.alertedAt ?? nowMs });
  return notification;
}

function resolveEndpointFailureIncident(endpoint: Endpoint) {
  if (!activeEndpointFailures.has(endpoint.id)) return;
  activeEndpointFailures.delete(endpoint.id);
}

function syncProjectEndpointCount(projectId: string) {
  const project = projects.find((item) => item.id === projectId);
  if (!project) return;
  project.endpointCount = endpoints.filter((endpoint) => endpoint.projectId === projectId).length;
  project.updatedAt = now();
}

function inferValueType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function mergeSchemas(left: unknown, right: unknown): unknown {
  if (!left) return right;
  if (!right) return left;
  if (typeof left === 'string' || typeof right === 'string') {
    return left === right ? left : `${left}|${right}`;
  }
  if (typeof left === 'object' && typeof right === 'object' && !Array.isArray(left) && !Array.isArray(right)) {
    const merged: Record<string, unknown> = { ...(left as Record<string, unknown>) };
    Object.entries(right as Record<string, unknown>).forEach(([key, value]) => {
      merged[key] = key in merged ? mergeSchemas(merged[key], value) : value;
    });
    return merged;
  }
  return inferValueType(right);
}

function inferSchema(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    const objectItems = value.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
    if (objectItems.length > 0) {
      return objectItems.reduce<Record<string, unknown>>((schema, item) => mergeSchemas(schema, inferSchema(item)) as Record<string, unknown>, {});
    }
    return { items: value.length ? inferValueType(value[0]) : 'unknown[]' };
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((schema, [key, item]) => {
      if (Array.isArray(item)) {
        schema[key] = item.length && item[0] && typeof item[0] === 'object'
          ? { type: 'array', items: inferSchema(item) }
          : { type: 'array', items: item.length ? inferValueType(item[0]) : 'unknown' };
      } else if (item && typeof item === 'object') {
        schema[key] = inferSchema(item);
      } else {
        schema[key] = inferValueType(item);
      }
      return schema;
    }, {});
  }

  return { value: inferValueType(value) };
}

function flattenSchema(schema: unknown, prefix = ''): Record<string, string> {
  if (typeof schema === 'string') {
    return prefix ? { [prefix]: schema } : { value: schema };
  }

  if (!schema || typeof schema !== 'object') {
    return prefix ? { [prefix]: inferValueType(schema) } : {};
  }

  const node = schema as Record<string, unknown>;
  if (node.type === 'array') {
    if (typeof node.items === 'string') return { [prefix || 'items']: `${node.items}[]` };
    return flattenSchema(node.items, prefix ? `${prefix}[]` : 'items[]');
  }

  return Object.entries(node).reduce<Record<string, string>>((acc, [key, value]) => {
    Object.assign(acc, flattenSchema(value, prefix ? `${prefix}.${key}` : key));
    return acc;
  }, {});
}

function formatSchemaChange(change: DriftEvent['changes'][number]) {
  if (change.type === 'removed') return `Removed field: ${change.field}`;
  if (change.type === 'added') return `Added field: ${change.field}`;
  return `Type changed: ${change.field} ${String(change.expected)} -> ${String(change.actual)}`;
}

function compareSchemas(oldSchema: Record<string, unknown>, newSchema: Record<string, unknown>) {
  const oldFlat = flattenSchema(oldSchema);
  const newFlat = flattenSchema(newSchema);
  const changes: DriftEvent['changes'] = [];

  Object.entries(oldFlat).forEach(([pathName, expected]) => {
    if (!(pathName in newFlat)) {
      changes.push({ path: pathName, field: pathName.split('.').pop() || pathName, expected, actual: undefined, type: 'removed' });
      return;
    }
    if (newFlat[pathName] !== expected) {
      changes.push({ path: pathName, field: pathName.split('.').pop() || pathName, expected, actual: newFlat[pathName], type: 'modified' });
    }
  });

  Object.entries(newFlat).forEach(([pathName, actual]) => {
    if (!(pathName in oldFlat)) {
      changes.push({ path: pathName, field: pathName.split('.').pop() || pathName, expected: undefined, actual, type: 'added' });
    }
  });

  const severity: DriftEvent['severity'] = changes.some((change) => change.type === 'removed' || change.type === 'modified')
    ? 'breaking'
    : changes.length
    ? 'medium'
    : 'low';

  return { changes, severity };
}

function validateFullHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPlainSchemaObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function endpointFailureMessage(endpoint: Endpoint, reason: string, source: 'baseline' | 'refresh' | 'monitoring' = 'monitoring') {
  const scope = source === 'baseline' ? 'capturing the baseline' : source === 'refresh' ? 'manual refresh' : 'monitoring';
  return `${endpoint.name} endpoint failed during ${scope}. ${endpoint.method} ${endpoint.url}. Reason: ${reason}`;
}

function endpointRequestInit(endpoint: Endpoint): RequestInit {
  const headers = endpoint.headers || {};
  const method = endpoint.method || 'GET';
  const hasBody = !['GET', 'DELETE'].includes(method) && endpoint.body !== undefined;
  return {
    method,
    headers,
    body: hasBody ? JSON.stringify(endpoint.body) : undefined,
  };
}

async function fetchEndpointResponse(endpoint: Endpoint) {
  const startedAt = Date.now();
  const response = await fetch(endpoint.url, endpointRequestInit(endpoint));
  const responseTime = Date.now() - startedAt;
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { value: text };
  }
  return { statusCode: response.status, responseTime, ok: response.ok, body };
}

function addMonitoringLog(endpoint: Endpoint, statusCode: number, responseTime: number, success: boolean, errorMessage?: string) {
  const log: MonitoringLog = {
    id: uuidv4(),
    projectId: endpoint.projectId,
    endpointId: endpoint.id,
    statusCode,
    responseTime,
    success,
    errorMessage,
    createdAt: now(),
  };
  monitoringLogs.unshift(log);
  return log;
}

function monitorEndpoint(endpoint: Endpoint) {
  const checkedAt = now();
  const responseTime = 80 + Math.floor(Math.random() * 240);
  const failed = endpoint.url.toLowerCase().includes('fail') || endpoint.status === 'failed';
  endpoint.responseTime = responseTime;
  endpoint.lastCheckedAt = checkedAt;
  endpoint.status = failed ? 'failed' : responseTime > 260 ? 'warning' : endpoint.status === 'drifted' ? 'drifted' : 'healthy';
  endpoint.health = failed ? 20 : responseTime > 260 ? 72 : endpoint.status === 'drifted' ? 68 : 98;
  endpoint.updatedAt = checkedAt;

  const log: MonitoringLog = {
    id: uuidv4(),
    projectId: endpoint.projectId,
    endpointId: endpoint.id,
    statusCode: failed ? 500 : 200,
    responseTime,
    success: !failed,
    errorMessage: failed ? 'Endpoint returned an error during monitoring check' : undefined,
    createdAt: checkedAt,
  };
  monitoringLogs.unshift(log);

  if (failed) {
    createEndpointFailureIncident(endpoint, 'Endpoint returned an error during monitoring check');
  }

  return { endpoint, log };
}

function createApiKey(projectId: string, name: string, scopes: string[]) {
  const fullKey = `db_live_${crypto.randomBytes(18).toString('hex')}`;
  const key: ApiKey = {
    id: uuidv4(),
    projectId,
    name,
    keyHash: crypto.createHash('sha256').update(fullKey).digest('hex'),
    keyPrefix: `${fullKey.slice(0, 12)}...${fullKey.slice(-4)}`,
    scopes,
    status: 'active',
    createdAt: now(),
    fullKey,
  };
  apiKeys.unshift(key);
  createNotification(projectId, 'system', 'API key created', `${name} was created for this project.`);
  return key;
}

function rotatedKeyName(name: string) {
  return `${name.replace(/(\s+rotated)+$/i, '').trim() || 'API Key'} rotated`;
}

function publicApiKey(key: ApiKey, reveal = false) {
  const { keyHash: _keyHash, fullKey, ...publicKey } = key;
  return reveal ? { ...publicKey, fullKey } : publicKey;
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function driftChangeType(change: DriftEvent['changes'][number]) {
  if (change.expected === undefined || change.expected === null) return 'added';
  if (change.actual === undefined || change.actual === null) return 'removed';
  return 'modified';
}

function driftFieldName(change: DriftEvent['changes'][number]) {
  return change.field || change.path.split('.').pop() || change.path;
}

function summarizeDriftChanges(changes: DriftEvent['changes']) {
  const added = changes.filter((change) => driftChangeType(change) === 'added').map(driftFieldName);
  const removed = changes.filter((change) => driftChangeType(change) === 'removed').map(driftFieldName);
  const modified = changes.filter((change) => driftChangeType(change) === 'modified').map(driftFieldName);
  return [
    removed.length ? `${removed.join(', ')} removed` : '',
    added.length ? `${added.join(', ')} added` : '',
    modified.length ? `${modified.join(', ')} changed` : '',
  ].filter(Boolean).join(', ') || `${changes.length} schema change${changes.length === 1 ? '' : 's'}`;
}

function applyDriftExportFilters(eventsToFilter: DriftEvent[], query: Request['query']) {
  const severity = typeof query.severity === 'string' ? query.severity.toLowerCase() : '';
  const status = typeof query.status === 'string' ? query.status.toLowerCase() : '';
  const search = typeof query.search === 'string' ? query.search.toLowerCase().trim() : '';
  const dateRange = typeof query.dateRange === 'string' ? query.dateRange : '';

  return eventsToFilter.filter((event) => {
    const eventSeverity = event.severity === 'critical' || event.severity === 'high' ? 'breaking' : event.severity;
    if (severity && severity !== 'all' && eventSeverity !== severity) return false;
    if (status && status !== 'all') {
      if (status === 'open' && event.status !== 'new') return false;
      if (status !== 'open' && event.status !== status) return false;
    }
    if (search) {
      const haystack = `${event.endpointName} ${event.message} ${event.changes.map((change) => `${change.path} ${change.field}`).join(' ')}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (dateRange) {
      const maxAge =
        dateRange === '24h' ? 24 * 60 * 60 * 1000 :
        dateRange === '7d' ? 7 * 24 * 60 * 60 * 1000 :
        dateRange === '30d' ? 30 * 24 * 60 * 60 * 1000 :
        0;
      if (maxAge > 0 && Date.now() - new Date(event.detectedAt).getTime() > maxAge) return false;
    }
    return true;
  });
}

function frequencyToMs(value?: string) {
  const match = String(value || '5m').trim().toLowerCase().match(/^(\d+)\s*(s|sec|secs|m|min|mins|h|hr|hrs)$/);
  if (!match) return 5 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit.startsWith('s')) return amount * 1000;
  if (unit.startsWith('h')) return amount * 60 * 60 * 1000;
  return amount * 60 * 1000;
}

const lastAutoRefreshAt = new Map<string, number>();
const activeEndpointFailures = new Map<string, { signature: string; notificationId: string; alertedAt: number }>();
const EXTERNAL_ALERT_COOLDOWN_MS = 30 * 60 * 1000;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'driftboard-backend', timestamp: now() });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'healthy', database: 'demo-memory', redis: 'demo-memory', timestamp: now() });
});

app.post('/api/auth/login', sendLoginResponse);
app.post('/api/auth/register', sendRegisterResponse);
app.post('/api/auth/forgot-password', sendForgotPasswordResponse);
app.post('/api/auth/reset-password', sendResetPasswordResponse);
app.post('/api/auth/social', sendSocialLoginResponse);
app.get('/api/auth/oauth/:provider/start', (req, res) => {
  const provider = req.params.provider === 'google' || req.params.provider === 'github' ? req.params.provider : null;
  if (!provider) {
    redirectWithAuthError(res, 'Unsupported sign-in provider.');
    return;
  }

  const config = getOAuthConfig(provider);
  if (!config.clientId || !config.clientSecret) {
    redirectWithAuthError(res, `${provider === 'google' ? 'Google' : 'GitHub'} sign-in is not configured yet.`);
    return;
  }

  const state = crypto.randomBytes(16).toString('hex');
  const authorizeUrl = new URL(config.authorizeUrl);
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('redirect_uri', oauthRedirectUri(provider));
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('state', state);
  if (provider === 'google') {
    authorizeUrl.searchParams.set('scope', 'openid email profile');
    authorizeUrl.searchParams.set('prompt', 'select_account');
  } else {
    authorizeUrl.searchParams.set('scope', 'read:user user:email');
  }
  res.redirect(authorizeUrl.toString());
});
app.get('/api/auth/oauth/:provider/callback', async (req, res) => {
  const provider = req.params.provider === 'google' || req.params.provider === 'github' ? req.params.provider : null;
  const code = typeof req.query.code === 'string' ? req.query.code : '';

  if (!provider || !code) {
    redirectWithAuthError(res, 'Sign-in was cancelled or incomplete.');
    return;
  }

  try {
    const user = provider === 'google'
      ? await completeGoogleOAuth(code)
      : await completeGitHubOAuth(code);
    redirectWithAuthSuccess(res, user);
  } catch (error) {
    redirectWithAuthError(res, error instanceof Error ? error.message : 'Could not complete sign-in.');
  }
});
app.post('/api/auth/refresh', (_req, res) => {
  res.json({ token: issueToken(demoUser) });
});
app.post('/api/auth/logout', (_req, res) => {
  saveAppState();
  res.status(204).send();
});
app.get('/api/auth/me', (_req, res) => {
  const user = requireRequestUser(_req, res);
  if (!user) return;
  res.json(publicUser(user));
});
app.patch('/api/auth/profile', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = normalizeEmail(req.body?.email) || user.email;
  const username = normalizeUsername(req.body?.username, email || user.username);
  const avatar = typeof req.body?.avatar === 'string' ? req.body.avatar : undefined;

  if (!name) {
    res.status(400).json({ message: 'Full name is required' });
    return;
  }

  if (isEmailTaken(email, user.id)) {
    res.status(409).json({ message: 'That email is already in use.' });
    return;
  }

  if (isUsernameTaken(username, user.id)) {
    res.status(409).json({ message: 'That username is already taken.' });
    return;
  }

  const previousEmail = user.email;
  const updatedUser = updateUser(user.id, {
    name,
    email,
    username,
    avatar: avatar !== undefined ? avatar : user.avatar,
  });
  if (updatedUser) {
    syncUserMembershipAfterProfileChange(previousEmail, updatedUser);
  }

  res.json(publicUser(updatedUser || user));
});
app.post('/api/auth/change-password', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;

  const currentPassword = String(req.body?.currentPassword || req.body?.oldPassword || '');
  const newPassword = String(req.body?.newPassword || '');

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    res.status(400).json({ message: 'Current password and a new password of at least 8 characters are required' });
    return;
  }

  if (!bcrypt.compareSync(currentPassword, user.passwordHash || '')) {
    res.status(400).json({ message: 'Current password is incorrect' });
    return;
  }

  updateUser(user.id, {
    passwordHash: bcrypt.hashSync(newPassword, 10),
    authProvider: 'password',
  });

  res.json({ ok: true });
});
app.put('/api/user/profile', (req, res) => {
  req.url = '/api/auth/profile';
  const user = requireRequestUser(req, res);
  if (!user) return;

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = normalizeEmail(req.body?.email) || user.email;
  const username = normalizeUsername(req.body?.username, email || user.username);
  if (!name) {
    res.status(400).json({ message: 'Full name is required' });
    return;
  }
  if (isEmailTaken(email, user.id)) {
    res.status(409).json({ message: 'That email is already in use.' });
    return;
  }
  if (isUsernameTaken(username, user.id)) {
    res.status(409).json({ message: 'That username is already taken.' });
    return;
  }
  const previousEmail = user.email;
  const updatedUser = updateUser(user.id, { name, email, username, avatar: typeof req.body?.avatar === 'string' ? req.body.avatar : user.avatar });
  if (updatedUser) {
    syncUserMembershipAfterProfileChange(previousEmail, updatedUser);
  }
  res.json(publicUser(updatedUser || user));
});
app.put('/api/user/password', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;

  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    res.status(400).json({ message: 'Current password and a new password of at least 8 characters are required' });
    return;
  }
  if (!bcrypt.compareSync(currentPassword, user.passwordHash || '')) {
    res.status(400).json({ message: 'Current password is incorrect' });
    return;
  }
  updateUser(user.id, { passwordHash: bcrypt.hashSync(newPassword, 10), authProvider: 'password' });
  res.json({ ok: true });
});
app.post('/api/user/avatar', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;

  const avatar = typeof req.body?.avatar === 'string' ? req.body.avatar : '';
  if (!avatar) {
    res.status(400).json({ message: 'Avatar image is required' });
    return;
  }
  const updatedUser = updateUser(user.id, { avatar });
  res.json(publicUser(updatedUser || user));
});

app.get('/api/projects', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  refreshMonitoringStatuses();
  res.json(visibleProjectsForUser(user));
});

app.get('/api/projects/:id', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  refreshMonitoringStatuses();
  if (req.params.id === 'current') {
    const visibleProjects = visibleProjectsForUser(user);
    res.json(visibleProjects.find((project) => project.id !== 'project_demo') || visibleProjects.find((project) => project.id === 'project_demo') || null);
    return;
  }
  const project = projects.find((item) => item.id === req.params.id);
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }
  if (!userHasProjectPermission(project.id, user, 'project:view')) {
    deny(res);
    return;
  }
  res.json(projectForUser(project, user));
});

app.get('/api/projects/current', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  refreshMonitoringStatuses();
  const visibleProjects = visibleProjectsForUser(user);
  res.json(visibleProjects.find((project) => project.id !== 'project_demo') || visibleProjects.find((project) => project.id === 'project_demo') || null);
});

app.get('/api/projects/:projectId/state', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  const project = projects.find((item) => item.id === req.params.projectId);
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }
  if (!userHasProjectPermission(project.id, user, 'project:view')) {
    deny(res);
    return;
  }
  refreshMonitoringStatuses();
  const projectEndpoints = endpoints.filter((endpoint) => endpoint.projectId === project.id);
  res.json({
    project: projectForUser(project, user),
    endpoints: projectEndpoints,
    uploadedFiles: uploadedFiles.filter((file) => file.projectId === project.id),
    schemaVersions: projectEndpoints.flatMap((endpoint) => endpoint.schemaVersions),
    driftEvents: driftEvents.filter((event) => event.projectId === project.id),
    notifications: notifications.filter((notification) => notification.projectId === project.id),
    apiKeys: apiKeys.filter((key) => key.projectId === project.id).map((key) => publicApiKey(key)),
    teamMembers: teamMembers
      .filter((member) => member.projectId === project.id && member.status !== 'removed')
      .map(normalizeTeamMember),
    notificationSettings: notificationChannels,
    monitoringLogs: monitoringLogs.filter((log) => log.projectId === project.id),
  });
});

app.get('/api/projects/:projectId/files', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  if (!userHasProjectPermission(req.params.projectId, user, 'project:view')) {
    deny(res);
    return;
  }
  res.json(uploadedFiles.filter((file) => file.projectId === req.params.projectId));
});

function createProjectHandler(req: Request, res: Response) {
  const user = requireAccountProjectCreate(req, res);
  if (!user) return;

  const name = String(req.body?.name || '').trim();
  const description = String(req.body?.description || '').trim();
  const sourceType = normalizeSourceType(req.body?.sourceType);
  const sourceLabel = String(req.body?.sourceLabel || '').trim();
  const detectedEndpoints = Array.isArray(req.body?.detectedEndpoints)
    ? (req.body.detectedEndpoints as DetectedEndpoint[]).filter((endpoint) => endpoint?.url && endpoint?.method)
    : [];
  const replaceExisting = Boolean(req.body?.replaceExisting);

  if (!name || !sourceLabel) {
    res.status(400).json({ message: 'Project name and project source are required' });
    return;
  }

  const existingUserProjects = projects.filter((project) => project.id !== 'project_demo' && project.ownerId === user.id);
  const existingSameProject = existingUserProjects.find(
    (project) =>
      project.sourceLabel?.toLowerCase() === sourceLabel.toLowerCase() ||
      project.slug === slugifyProjectName(name)
  );

  if (existingSameProject) {
    existingSameProject.name = name;
    existingSameProject.description = description || existingSameProject.description;
    existingSameProject.sourceType = sourceType;
    existingSameProject.sourceLabel = sourceLabel;
    startProjectMonitoring(existingSameProject, req.body?.duration || 'all');

    if (detectedEndpoints.length > 0 && endpoints.filter((endpoint) => endpoint.projectId === existingSameProject.id).length === 0) {
      const createdEndpoints = detectedEndpoints.map((endpoint) => createEndpointFromDetection(existingSameProject.id, endpoint));
      endpoints.push(...createdEndpoints);
      existingSameProject.endpointCount = createdEndpoints.length;
      createdEndpoints.forEach((endpoint) => io.emit('endpoint:created', endpoint));
    }

    const fileMetadata = buildUploadedFiles(user.id, existingSameProject.id, req.body?.uploadedFiles, sourceLabel, Number(req.body?.fileCount || 0));
    if (fileMetadata.length > 0) {
      uploadedFiles.splice(0, uploadedFiles.length, ...uploadedFiles.filter((file) => file.projectId !== existingSameProject.id), ...fileMetadata);
    }

    ensureProjectAdmin(existingSameProject.id, user);
    createNotification(existingSameProject.id, 'system', 'Project resumed', `${existingSameProject.name} is ready and monitoring can resume.`);
    res.json(projectForUser(existingSameProject, user));
    return;
  }

  if (existingUserProjects.length > 0 && !replaceExisting) {
    res.status(409).json({
      message: 'You already have a saved live project. Replace it with this project?',
      code: 'PROJECT_REPLACE_REQUIRED',
      existingProject: existingUserProjects[0],
    });
    return;
  }

  if (replaceExisting) {
    existingUserProjects.forEach((project) => removeProjectData(project.id));
  } else {
    clearLiveProject('A new project was connected', user.id);
  }

  const createdAt = now();
  const project: Project = {
    id: uuidv4(),
    name,
    slug: slugifyProjectName(name),
    description,
    teamId: 'team_demo',
    ownerId: user.id,
    memberCount: 1,
    endpointCount: 0,
    sourceType,
    sourceLabel,
    monitoringStatus: 'monitoring',
    monitoringStartedAt: createdAt,
    monitoringEndsAt: null,
    monitoringDuration: 'all',
    createdAt,
    updatedAt: createdAt,
  };

  const createdEndpoints = detectedEndpoints.map((endpoint) => createEndpointFromDetection(project.id, endpoint));
  endpoints.push(...createdEndpoints);
  project.endpointCount = createdEndpoints.length;
  projects.unshift(project);
  uploadedFiles.push(...buildUploadedFiles(user.id, project.id, req.body?.uploadedFiles, sourceLabel, Number(req.body?.fileCount || 0)));
  ensureProjectAdmin(project.id, user);
  createNotification(
    project.id,
    'system',
    'Project connected',
    `${project.name} is connected and monitoring ${project.endpointCount} endpoint${project.endpointCount === 1 ? '' : 's'}.`
  );

  io.emit('project:created', project);
  io.emit('project:monitoring-started', {
    projectId: project.id,
    sourceType,
    sourceLabel,
    endpointCount: project.endpointCount,
    startedAt: createdAt,
  });
  createdEndpoints.forEach((endpoint) => io.emit('endpoint:created', endpoint));
  res.status(201).json(projectForUser(project, user));
}

app.post('/api/projects', createProjectHandler);
app.post('/api/projects/connect-github', createProjectHandler);
app.post('/api/projects/upload', createProjectHandler);

app.post('/api/projects/:projectId/replace', (req, res) => {
  req.body = { ...req.body, replaceExisting: true };
  createProjectHandler(req, res);
});

app.post('/api/projects/disconnect', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  if (!['owner', 'admin'].includes(user.role)) {
    deny(res);
    return;
  }
  clearLiveProject('Project disconnected by user', user.id);
  createNotification('project_demo', 'system', 'Project disconnected', 'Live monitoring has stopped. Your project data is saved and ready to resume.');
  res.status(204).send();
});

function startMonitoringHandler(req: Request, res: Response) {
  const project = projects.find((item) => item.id === req.params.projectId);
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }
  const user = requireProjectPermission(req, res, project.id, 'scan:run');
  if (!user) return;

  startProjectMonitoring(project, req.body?.duration);
  createNotification(
    project.id,
    'system',
    'Monitoring started',
    project.monitoringEndsAt
      ? `${project.name} monitoring will run until ${new Date(project.monitoringEndsAt).toLocaleString()}.`
      : `${project.name} monitoring will run continuously.`
  );
  io.emit('project:monitoring-started', {
    projectId: project.id,
    duration: project.monitoringDuration,
    startedAt: project.monitoringStartedAt,
    endsAt: project.monitoringEndsAt,
  });
  res.json(project);
}

app.post('/api/projects/:projectId/monitoring/start', startMonitoringHandler);
app.post('/api/projects/:projectId/resume-monitoring', startMonitoringHandler);

function stopMonitoringHandler(req: Request, res: Response) {
  const project = projects.find((item) => item.id === req.params.projectId);
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }
  const user = requireProjectPermission(req, res, project.id, 'scan:run');
  if (!user) return;

  project.monitoringStatus = 'disconnected';
  project.monitoringEndsAt = null;
  project.updatedAt = now();
  endpoints
    .filter((endpoint) => endpoint.projectId === project.id)
    .forEach((endpoint) => {
      endpoint.monitoringEnabled = false;
      endpoint.status = 'disabled';
      endpoint.updatedAt = project.updatedAt;
    });
  createNotification(project.id, 'system', 'Monitoring stopped', `${project.name} monitoring is disconnected.`);
  io.emit('project:disconnected', { projectIds: [project.id], reason: req.body?.reason || 'Monitoring stopped', disconnectedAt: project.updatedAt });
  res.json(project);
}

app.post('/api/projects/:projectId/monitoring/stop', stopMonitoringHandler);
app.post('/api/projects/:projectId/stop-monitoring', stopMonitoringHandler);

app.get('/api/projects/:projectId/endpoints', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  if (!userHasProjectPermission(req.params.projectId, user, 'endpoint:view')) {
    deny(res);
    return;
  }
  refreshMonitoringStatuses();
  res.json(endpoints.filter((endpoint) => endpoint.projectId === req.params.projectId));
});

app.post('/api/projects/:projectId/endpoints', async (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }
  const user = requireProjectPermission(req, res, project.id, 'endpoint:create');
  if (!user) return;

  const method = String(req.body?.method || 'GET').toUpperCase();
  const url = String(req.body?.url || '').trim();
  if (!url || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    res.status(400).json({ message: 'Valid endpoint method and URL are required' });
    return;
  }
  if (!validateFullHttpUrl(url)) {
    res.status(400).json({ message: 'Please enter full URL including http:// or https://' });
    return;
  }

  const hasManualSchema = req.body?.currentSchema !== undefined && req.body?.currentSchema !== null;
  if (hasManualSchema && !isPlainSchemaObject(req.body.currentSchema)) {
    res.status(400).json({ message: 'Initial Schema must be a valid JSON object.' });
    return;
  }

  let initialSchema = (hasManualSchema ? req.body.currentSchema : {}) as Record<string, unknown>;
  let baselineCreated = hasManualSchema;
  let initialResponseTime = 0;
  let initialStatus: Endpoint['status'] = 'healthy';
  let initialHealth = 100;
  let baselineLog: MonitoringLog | null = null;

  const endpoint: Endpoint = {
    id: uuidv4(),
    projectId: req.params.projectId,
    name: String(req.body?.name || endpointName(method, url)),
    url,
    method: method as Endpoint['method'],
    headers: req.body?.headers || {},
    body: req.body?.body,
    status: initialStatus,
    health: initialHealth,
    responseTime: initialResponseTime,
    monitoringEnabled: req.body?.monitoringEnabled !== false,
    frequency: String(req.body?.frequency || '5m'),
    currentSchema: initialSchema,
    currentSchemaVersion: baselineCreated ? 1 : 0,
    schemaVersions: [],
    createdAt: now(),
    updatedAt: now(),
  };

  try {
    const result = await fetchEndpointResponse(endpoint);
    if (result.ok && !hasManualSchema) {
      initialSchema = inferSchema(result.body);
      baselineCreated = true;
      endpoint.currentSchemaVersion = 1;
    }
    initialResponseTime = result.responseTime;
    initialStatus = result.ok ? 'healthy' : 'failed';
    initialHealth = result.ok ? 100 : 15;
    endpoint.currentSchema = initialSchema;
    endpoint.responseTime = initialResponseTime;
    endpoint.status = initialStatus;
    endpoint.health = initialHealth;
    endpoint.lastCheckedAt = now();
    baselineLog = addMonitoringLog(endpoint, result.statusCode, result.responseTime, result.ok, result.ok ? undefined : `Endpoint returned ${result.statusCode}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Endpoint fetch failed';
    endpoint.status = 'failed';
    endpoint.health = 10;
    endpoint.lastCheckedAt = now();
    baselineLog = addMonitoringLog(endpoint, 0, 0, false, message);
  }

  if (baselineCreated) {
    endpoint.schemaVersions.push({
      id: uuidv4(),
      endpointId: endpoint.id,
      version: 1,
      schema: endpoint.currentSchema,
      createdAt: endpoint.createdAt,
      createdBy: hasManualSchema ? user.name : 'Monitoring engine',
      changelog: hasManualSchema ? 'Manual baseline schema' : 'Baseline schema captured from first successful response',
    });
  }
  endpoints.push(endpoint);
  syncProjectEndpointCount(endpoint.projectId);
  createNotification(
    endpoint.projectId,
    baselineCreated ? 'schema' : 'system',
    baselineCreated ? 'Endpoint added' : 'Endpoint saved without baseline',
    baselineCreated
      ? `${endpoint.name} baseline schema was captured as Version 1.`
      : `${endpoint.name} was saved, but DriftBoard still needs one successful response before schema drift can be detected.`,
    true,
    { endpoint, severity: baselineCreated ? 'low' : 'medium' }
  );
  if (endpoint.status === 'failed') {
    createEndpointFailureIncident(endpoint, baselineLog?.errorMessage || 'Endpoint could not be reached', 'baseline');
  }
  io.emit('endpoint:created', endpoint);
  res.status(201).json({ ...endpoint, latestLog: baselineLog });
});

app.get('/api/endpoints/:id', (req, res) => {
  const endpoint = endpoints.find((item) => item.id === req.params.id);
  if (!endpoint) {
    res.status(404).json({ message: 'Endpoint not found' });
    return;
  }
  const user = requireProjectPermission(req, res, endpoint.projectId, 'endpoint:view');
  if (!user) return;
  res.json(endpoint);
});

app.patch('/api/endpoints/:id', (req, res) => {
  const endpoint = endpoints.find((item) => item.id === req.params.id);
  if (!endpoint) {
    res.status(404).json({ message: 'Endpoint not found' });
    return;
  }
  const user = requireProjectPermission(req, res, endpoint.projectId, 'endpoint:update');
  if (!user) return;
  if (req.body?.url !== undefined) {
    const nextUrl = String(req.body.url || '').trim();
    if (!validateFullHttpUrl(nextUrl)) {
      res.status(400).json({ message: 'Please enter full URL including http:// or https://' });
      return;
    }
    req.body.url = nextUrl;
  }
  if (req.body?.currentSchema !== undefined && !isPlainSchemaObject(req.body.currentSchema)) {
    res.status(400).json({ message: 'Initial Schema must be a valid JSON object.' });
    return;
  }
  Object.assign(endpoint, req.body, { updatedAt: now() });
  if (req.body?.status === 'disabled') endpoint.monitoringEnabled = false;
  io.emit('endpoint:updated', endpoint);
  res.json(endpoint);
});

app.delete('/api/endpoints/:id', (req, res) => {
  const index = endpoints.findIndex((item) => item.id === req.params.id);
  if (index >= 0) {
    const endpoint = endpoints[index];
    const user = requireProjectPermission(req, res, endpoint.projectId, 'endpoint:delete');
    if (!user) return;
    endpoints.splice(index, 1);
    driftEvents
      .filter((event) => event.endpointId === endpoint.id)
      .forEach((event) => {
        event.status = 'resolved';
        event.resolvedAt = now();
      });
    syncProjectEndpointCount(endpoint.projectId);
    createNotification(endpoint.projectId, 'system', 'Endpoint removed', `${endpoint.name} was removed from monitoring.`);
    io.emit('endpoint:deleted', req.params.id);
  }
  res.status(204).send();
});

app.get('/api/endpoints/:id/schema-history', (req, res) => {
  const endpoint = endpoints.find((item) => item.id === req.params.id);
  if (endpoint) {
    const user = requireProjectPermission(req, res, endpoint.projectId, 'schema:view');
    if (!user) return;
  }
  res.json(endpoint?.schemaVersions || []);
});

app.get('/api/endpoints/:id/history', (req, res) => {
  const endpoint = endpoints.find((item) => item.id === req.params.id);
  if (endpoint) {
    const user = requireProjectPermission(req, res, endpoint.projectId, 'schema:view');
    if (!user) return;
  }
  res.json(endpoint?.schemaVersions || []);
});

app.post('/api/endpoints/:id/test', (req, res) => {
  refreshMonitoringStatuses();
  const endpoint = endpoints.find((item) => item.id === req.params.id);
  if (!endpoint) {
    res.status(404).json({ message: 'Endpoint not found' });
    return;
  }
  const user = requireProjectPermission(req, res, endpoint.projectId, 'scan:run');
  if (!user) return;
  if (req.body?.currentSchema) {
    endpoint.currentSchema = req.body.currentSchema;
  }
  const result = monitorEndpoint(endpoint);
  io.emit('endpoint:checked', result);
  res.json(result);
});

app.post('/api/endpoints/:id/refresh', async (req, res) => {
  refreshMonitoringStatuses();
  const endpoint = endpoints.find((item) => item.id === req.params.id);
  if (!endpoint) {
    res.status(404).json({ message: 'Endpoint not found' });
    return;
  }
  const user = requireProjectPermission(req, res, endpoint.projectId, 'scan:run');
  if (!user) return;
  const project = projects.find((item) => item.id === endpoint.projectId);
  if (project?.monitoringStatus === 'disconnected') {
    res.status(409).json({ message: 'Project monitoring is disconnected. Start monitoring again first.' });
    return;
  }
  let response;
  let log: MonitoringLog;
  try {
    response = await fetchEndpointResponse(endpoint);
    log = addMonitoringLog(endpoint, response.statusCode, response.responseTime, response.ok, response.ok ? undefined : `Endpoint returned ${response.statusCode}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Endpoint fetch failed';
    endpoint.status = 'failed';
    endpoint.health = 10;
    endpoint.lastCheckedAt = now();
    endpoint.updatedAt = endpoint.lastCheckedAt;
    log = addMonitoringLog(endpoint, 0, 0, false, message);
    const notification = createEndpointFailureIncident(endpoint, message, 'refresh');
    io.emit('endpoint:checked', { endpoint, log, notification, changed: false, failure: true });
    res.json({ endpoint, log, notification, changed: false, failure: true });
    return;
  }

  endpoint.responseTime = response.responseTime;
  endpoint.lastCheckedAt = now();
  endpoint.updatedAt = endpoint.lastCheckedAt;

  if (!response.ok) {
    endpoint.status = 'failed';
    endpoint.health = 15;
    const reason = `Endpoint returned HTTP ${response.statusCode}`;
    const notification = createEndpointFailureIncident(endpoint, reason, 'refresh');
    io.emit('endpoint:checked', { endpoint, log, notification, changed: false, failure: true });
    res.json({ endpoint, log, notification, changed: false, failure: true });
    return;
  }

  resolveEndpointFailureIncident(endpoint);
  const incomingSchema = req.body?.currentSchema || inferSchema(response.body);
  if (!isPlainSchemaObject(incomingSchema)) {
    res.status(400).json({ message: 'Initial Schema must be a valid JSON object.' });
    return;
  }

  if (endpoint.currentSchemaVersion < 1 || endpoint.schemaVersions.length === 0) {
    endpoint.currentSchema = incomingSchema;
    endpoint.currentSchemaVersion = 1;
    endpoint.status = 'healthy';
    endpoint.health = Math.max(90, 100 - Math.floor(response.responseTime / 80));
    const schemaVersion = {
      id: uuidv4(),
      endpointId: endpoint.id,
      version: 1,
      schema: incomingSchema,
      createdAt: now(),
      createdBy: 'Monitoring engine',
      changelog: 'Baseline schema captured from first successful response',
    };
    endpoint.schemaVersions.push(schemaVersion);
    resolveEndpointFailureIncident(endpoint);
    const notification = createNotification(endpoint.projectId, 'schema', 'Baseline Schema Captured', `${endpoint.name} first successful response was saved as Version 1.`, false, { endpoint, severity: 'low' });
    io.emit('endpoint:checked', { endpoint, log, schemaVersion, notification, changed: false });
    res.json({ endpoint, log, schemaVersion, notification, changed: false });
    return;
  }

  const comparison = compareSchemas(endpoint.currentSchema, incomingSchema);
  const changed = comparison.changes.length > 0;
  let schemaVersion = null;
  let event: DriftEvent | null = null;
  let driftNotification = null;
  let versionNotification = null;

  if (changed) {
    const version = endpoint.currentSchemaVersion + 1;
    const oldVersion = endpoint.schemaVersions.find((item) => item.version === endpoint.currentSchemaVersion) || endpoint.schemaVersions[endpoint.schemaVersions.length - 1];
    endpoint.currentSchema = incomingSchema;
    endpoint.currentSchemaVersion = version;
    endpoint.status = 'drifted';
    endpoint.health = comparison.severity === 'breaking' ? 62 : 78;
    endpoint.lastDriftAt = now();
    schemaVersion = {
      id: uuidv4(),
      endpointId: endpoint.id,
      version,
      schema: incomingSchema,
      createdAt: now(),
      createdBy: 'Monitoring engine',
      changelog: comparison.changes.map(formatSchemaChange).join(', '),
    };
    endpoint.schemaVersions.push(schemaVersion);
    event = {
      id: uuidv4(),
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      projectId: endpoint.projectId,
      projectName: projects.find((project) => project.id === endpoint.projectId)?.name || 'Project',
      severity: comparison.severity,
      status: 'new',
      detectedAt: now(),
      message: `${endpoint.name} changed: ${comparison.changes.map(formatSchemaChange).join(', ')}`,
      changes: comparison.changes,
    };
    driftEvents.unshift(event);
    driftNotification = createNotification(endpoint.projectId, 'drift', 'API Drift Detected', event.message, true, { endpoint, driftEvent: event, changes: event.changes, severity: event.severity });
    versionNotification = createNotification(endpoint.projectId, 'schema', `Schema Version ${version} created`, `${endpoint.name} changed from Version ${oldVersion?.version || version - 1} to Version ${version}.`, false, { endpoint, driftEvent: event, changes: event.changes, severity: event.severity });
    io.emit('drift:new', event);
  } else {
    resolveEndpointFailureIncident(endpoint);
    endpoint.status = response.ok ? 'healthy' : 'failed';
    endpoint.health = response.ok ? Math.max(90, 100 - Math.floor(response.responseTime / 80)) : 15;
  }

  io.emit('endpoint:checked', { endpoint, log, schemaVersion, event, notification: driftNotification || versionNotification });
  res.json({ endpoint, log, schemaVersion, event, notification: driftNotification, versionNotification, changed });
});

app.post('/api/endpoints/:id/rollback', (req, res) => {
  const endpoint = endpoints.find((item) => item.id === req.params.id);
  if (!endpoint) {
    res.status(404).json({ message: 'Endpoint not found' });
    return;
  }
  const user = requireProjectPermission(req, res, endpoint.projectId, 'schema:update');
  if (!user) return;
  const version = endpoint.schemaVersions.find((item) => item.id === req.body?.versionId);
  if (version) {
    endpoint.currentSchema = version.schema;
    endpoint.currentSchemaVersion = version.version;
    endpoint.updatedAt = now();
    createNotification(endpoint.projectId, 'schema', 'Schema baseline rolled back', `${endpoint.name} was rolled back to Version ${version.version}.`);
  }
  res.json(endpoint);
});

app.get('/api/endpoints/:endpointId/schema-versions', (req, res) => {
  const endpoint = endpoints.find((item) => item.id === req.params.endpointId);
  if (endpoint) {
    const user = requireProjectPermission(req, res, endpoint.projectId, 'schema:view');
    if (!user) return;
  }
  res.json(endpoint?.schemaVersions || []);
});

app.get('/api/schema-versions/:id', (req, res) => {
  const version = endpoints.flatMap((endpoint) => endpoint.schemaVersions).find((item) => item.id === req.params.id);
  if (!version) {
    res.status(404).json({ message: 'Schema version not found' });
    return;
  }
  const projectId = schemaVersionProjectId(req.params.id);
  if (!projectId) {
    res.status(404).json({ message: 'Schema version not found' });
    return;
  }
  const user = requireProjectPermission(req, res, projectId, 'schema:view');
  if (!user) return;
  res.json(version);
});

app.post('/api/schema/compare', (req, res) => {
  const versionIds = Array.isArray(req.body?.versionIds) ? req.body.versionIds : [req.body?.leftVersionId, req.body?.rightVersionId];
  const versions = endpoints.flatMap((endpoint) => endpoint.schemaVersions).filter((item) => versionIds.includes(item.id));
  if (versions.length !== 2) {
    res.status(400).json({ message: 'Exactly two schema versions are required for comparison' });
    return;
  }
  const projectIds = new Set(
    versions
      .map((version) => schemaVersionProjectId(version.id))
      .filter((projectId): projectId is string => Boolean(projectId))
  );
  if (projectIds.size !== 1) {
    res.status(400).json({ message: 'Schema versions must belong to the same project' });
    return;
  }
  const user = requireProjectPermission(req, res, [...projectIds][0], 'schema:view');
  if (!user) return;
  const [left, right] = versions;
  const leftKeys = new Set(Object.keys(left.schema));
  const rightKeys = new Set(Object.keys(right.schema));
  res.json({
    left,
    right,
    addedFields: [...rightKeys].filter((key) => !leftKeys.has(key)),
    removedFields: [...leftKeys].filter((key) => !rightKeys.has(key)),
    datatypeChanges: [...leftKeys].filter((key) => rightKeys.has(key) && left.schema[key] !== right.schema[key]),
  });
});

app.post('/api/schema-versions/:id/rollback', (req, res) => {
  const endpoint = endpoints.find((item) => item.schemaVersions.some((version) => version.id === req.params.id));
  if (!endpoint) {
    res.status(404).json({ message: 'Schema version not found' });
    return;
  }
  const user = requireProjectPermission(req, res, endpoint.projectId, 'schema:update');
  if (!user) return;
  const version = endpoint.schemaVersions.find((item) => item.id === req.params.id)!;
  endpoint.currentSchema = version.schema;
  endpoint.currentSchemaVersion = version.version;
  endpoint.updatedAt = now();
  createNotification(endpoint.projectId, 'schema', 'Schema baseline rolled back', `${endpoint.name} was rolled back to Version ${version.version}.`);
  res.json(endpoint);
});

app.get('/api/drift', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  const visibleProjectIds = new Set(visibleProjectsForUser(user).map((project) => project.id));
  res.json(driftEvents.filter((event) => visibleProjectIds.has(event.projectId)));
});

app.get('/api/projects/:projectId/drift-events', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  if (!userHasProjectPermission(req.params.projectId, user, 'drift:view')) {
    deny(res);
    return;
  }
  res.json(driftEvents.filter((event) => event.projectId === req.params.projectId));
});

app.post('/api/projects/:projectId/drift-events/refresh', async (req, res) => {
  const user = requireProjectPermission(req, res, req.params.projectId, 'scan:run');
  if (!user) return;
  const projectEndpoints = endpoints.filter((endpoint) => endpoint.projectId === req.params.projectId);
  const checked = [];
  for (const endpoint of projectEndpoints) {
    if (endpoint.monitoringEnabled === false) continue;
    try {
      const response = await fetchEndpointResponse(endpoint);
      const log = addMonitoringLog(endpoint, response.statusCode, response.responseTime, response.ok, response.ok ? undefined : `Endpoint returned ${response.statusCode}`);
      endpoint.responseTime = response.responseTime;
      endpoint.lastCheckedAt = now();
      endpoint.updatedAt = endpoint.lastCheckedAt;
      if (!response.ok) {
        endpoint.status = 'failed';
        endpoint.health = 15;
        const notification = createEndpointFailureIncident(endpoint, `Endpoint returned HTTP ${response.statusCode}`);
        checked.push({ endpoint, log, notification, changed: false, failure: true });
      } else {
        resolveEndpointFailureIncident(endpoint);
        const latestSchema = inferSchema(response.body);
        if (endpoint.currentSchemaVersion < 1 || endpoint.schemaVersions.length === 0) {
          const schemaVersion = {
            id: uuidv4(),
            endpointId: endpoint.id,
            version: 1,
            schema: latestSchema,
            createdAt: now(),
            createdBy: 'Monitoring engine',
            changelog: 'Baseline schema captured from first successful response',
          };
          endpoint.schemaVersions.push(schemaVersion);
          endpoint.currentSchema = latestSchema;
          endpoint.currentSchemaVersion = 1;
          endpoint.status = 'healthy';
          endpoint.health = Math.max(90, 100 - Math.floor(response.responseTime / 80));
          createNotification(endpoint.projectId, 'schema', 'Baseline Schema Captured', `${endpoint.name} first successful response was saved as Version 1.`, false, { endpoint, severity: 'low' });
          checked.push({ endpoint, log, schemaVersion, changed: false });
          continue;
        }
        const comparison = compareSchemas(endpoint.currentSchema, latestSchema);
        if (comparison.changes.length) {
          const version = endpoint.currentSchemaVersion + 1;
          const schemaVersion = {
            id: uuidv4(),
            endpointId: endpoint.id,
            version,
            schema: latestSchema,
            createdAt: now(),
            createdBy: 'Monitoring engine',
            changelog: comparison.changes.map(formatSchemaChange).join(', '),
          };
          endpoint.schemaVersions.push(schemaVersion);
          endpoint.currentSchema = latestSchema;
          endpoint.currentSchemaVersion = version;
          endpoint.status = 'drifted';
          endpoint.health = comparison.severity === 'breaking' ? 62 : 78;
          endpoint.lastDriftAt = now();
          const event: DriftEvent = {
            id: uuidv4(),
            endpointId: endpoint.id,
            endpointName: endpoint.name,
            projectId: endpoint.projectId,
            projectName: projects.find((item) => item.id === endpoint.projectId)?.name || 'Project',
            severity: comparison.severity,
            status: 'new',
            detectedAt: now(),
            message: `${endpoint.name} changed: ${comparison.changes.map(formatSchemaChange).join(', ')}`,
            changes: comparison.changes,
          };
          driftEvents.unshift(event);
          createNotification(endpoint.projectId, 'drift', 'API Drift Detected', event.message, true, { endpoint, driftEvent: event, changes: event.changes, severity: event.severity });
          createNotification(endpoint.projectId, 'schema', `Schema Version ${version} created`, `${endpoint.name} changed to Version ${version}.`, false, { endpoint, driftEvent: event, changes: event.changes, severity: event.severity });
          io.emit('drift:new', event);
          checked.push({ endpoint, log, schemaVersion, event, changed: true });
        } else {
          endpoint.status = 'healthy';
          endpoint.health = Math.max(90, 100 - Math.floor(response.responseTime / 80));
          checked.push({ endpoint, log, changed: false });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Endpoint fetch failed';
      endpoint.status = 'failed';
      endpoint.health = 10;
      endpoint.lastCheckedAt = now();
      endpoint.updatedAt = endpoint.lastCheckedAt;
      const log = addMonitoringLog(endpoint, 0, 0, false, message);
      const notification = createEndpointFailureIncident(endpoint, message);
      checked.push({ endpoint, log, notification, changed: false, failure: true });
    }
  }
  res.json({
    checked: checked.length,
    events: driftEvents.filter((event) => event.projectId === req.params.projectId),
  });
});

app.get('/api/projects/:projectId/drift-events/export', (req, res) => {
  const user = requireProjectPermission(req, res, req.params.projectId, 'drift:view');
  if (!user) return;
  const project = projects.find((item) => item.id === req.params.projectId);
  const generatedAt = now();
  const projectEvents = applyDriftExportFilters(
    driftEvents.filter((event) => event.projectId === req.params.projectId),
    req.query
  );

  const rows = projectEvents.map((event) => {
    const added = event.changes.filter((change) => driftChangeType(change) === 'added').map(driftFieldName).join('; ');
    const removed = event.changes.filter((change) => driftChangeType(change) === 'removed').map(driftFieldName).join('; ');
    const datatypeChanges = event.changes
      .filter((change) => driftChangeType(change) === 'modified')
      .map((change) => `${driftFieldName(change)}: ${String(change.expected ?? 'missing')} -> ${String(change.actual ?? 'missing')}`)
      .join('; ');

    return [
      project?.name || event.projectName,
      generatedAt,
      event.endpointName,
      event.message,
      summarizeDriftChanges(event.changes),
      event.severity === 'critical' || event.severity === 'high' ? 'breaking' : event.severity,
      event.status,
      event.detectedAt,
      event.changes.length,
      added,
      removed,
      datatypeChanges,
    ];
  });

  const headers = [
    'project',
    'generatedAt',
    'endpoint',
    'report',
    'changeSummary',
    'severity',
    'status',
    'detectedAt',
    'changeCount',
    'addedFields',
    'removedFields',
    'datatypeChanges',
  ];
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="drift-events.csv"');
  res.send(csv);
});

app.get('/api/drift/stats', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  const visibleProjectIds = new Set(visibleProjectsForUser(user).map((project) => project.id));
  const visibleDrifts = driftEvents.filter((event) => visibleProjectIds.has(event.projectId));
  res.json({
    total: visibleDrifts.length,
    critical: visibleDrifts.filter((event) => event.severity === 'critical').length,
    high: visibleDrifts.filter((event) => event.severity === 'high').length,
    medium: visibleDrifts.filter((event) => event.severity === 'medium').length,
    low: visibleDrifts.filter((event) => event.severity === 'low').length,
    byEndpoint: visibleDrifts.reduce<Record<string, number>>((acc, event) => {
      acc[event.endpointId] = (acc[event.endpointId] || 0) + 1;
      return acc;
    }, {}),
    byDay: { [new Date().toISOString().slice(0, 10)]: visibleDrifts.length },
  });
});

app.post('/api/drift/:id/acknowledge', (req, res) => {
  const event = driftEvents.find((item) => item.id === req.params.id);
  if (event) {
    const user = requireProjectPermission(req, res, event.projectId, 'drift:update');
    if (!user) return;
  }
  if (event) {
    event.acknowledgedAt = now();
    event.status = 'acknowledged';
  }
  res.json(event || { ok: true });
});

app.post('/api/drift/:id/resolve', (req, res) => {
  const event = driftEvents.find((item) => item.id === req.params.id);
  if (event) {
    const user = requireProjectPermission(req, res, event.projectId, 'drift:update');
    if (!user) return;
  }
  if (event) {
    event.resolvedAt = now();
    event.status = 'resolved';
  }
  res.json(event || { ok: true });
});

app.put('/api/drift-events/:id/status', (req, res) => {
  const event = driftEvents.find((item) => item.id === req.params.id);
  if (!event) {
    res.status(404).json({ message: 'Drift event not found' });
    return;
  }
  const user = requireProjectPermission(req, res, event.projectId, 'drift:update');
  if (!user) return;
  const status = req.body?.status;
  if (!['new', 'acknowledged', 'resolved', 'ignored'].includes(status)) {
    res.status(400).json({ message: 'Valid drift event status is required' });
    return;
  }
  event.status = status;
  if (status === 'acknowledged') event.acknowledgedAt = now();
  if (status === 'resolved') event.resolvedAt = now();
  res.json(event);
});

app.post('/api/drift-events/bulk-action', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const action = String(req.body?.action || '');
  const updated: DriftEvent[] = [];
  for (let index = driftEvents.length - 1; index >= 0; index -= 1) {
    if (!ids.includes(driftEvents[index].id)) continue;
    if (!userHasProjectPermission(driftEvents[index].projectId, user, 'drift:update')) {
      deny(res);
      return;
    }
    if (action === 'delete') {
      driftEvents.splice(index, 1);
      continue;
    }
    if (['acknowledged', 'resolved', 'ignored', 'new'].includes(action)) {
      driftEvents[index].status = action as DriftEvent['status'];
      if (action === 'acknowledged') driftEvents[index].acknowledgedAt = now();
      if (action === 'resolved') driftEvents[index].resolvedAt = now();
      updated.push(driftEvents[index]);
    }
  }
  res.json({ updated, deleted: action === 'delete' ? ids.length : 0 });
});

app.get('/api/notifications', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  const visibleProjectIds = new Set(visibleProjectsForUser(user).map((project) => project.id));
  res.json(notifications.filter((notification) => notification.userId === user.id || visibleProjectIds.has(notification.projectId)));
});

function visibleNotificationIdsForUser(user: User) {
  const visibleProjectIds = new Set(visibleProjectsForUser(user).map((project) => project.id));
  return new Set(
    notifications
      .filter((notification) => notification.userId === user.id || visibleProjectIds.has(notification.projectId))
      .map((notification) => notification.id)
  );
}

app.get('/api/projects/:projectId/notifications', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  if (!userHasProjectPermission(req.params.projectId, user, 'notification:view')) {
    deny(res);
    return;
  }
  res.json(notifications.filter((notification) => notification.projectId === req.params.projectId));
});

app.put('/api/notifications/:id/read', (req, res) => {
  const notification = notifications.find((item) => item.id === req.params.id);
  if (!notification) {
    res.status(404).json({ message: 'Notification not found' });
    return;
  }
  notification.read = req.body?.read !== false;
  notification.updatedAt = now();
  saveAppState();
  res.json(notification);
});

app.post('/api/notifications/mark-all-read', (req, res) => {
  const projectId = req.body?.projectId;
  notifications
    .filter((notification) => !projectId || notification.projectId === projectId)
    .forEach((notification) => {
      notification.read = true;
      notification.updatedAt = now();
    });
  saveAppState();
  res.json({ ok: true });
});

app.post('/api/notifications/read-all', (req, res) => {
  const projectId = req.body?.projectId;
  notifications
    .filter((notification) => !projectId || notification.projectId === projectId)
    .forEach((notification) => {
      notification.read = true;
      notification.updatedAt = now();
    });
  saveAppState();
  res.json({ ok: true });
});

app.delete('/api/notifications', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  const visibleIds = visibleNotificationIdsForUser(user);
  const ids = Array.isArray(req.body?.ids)
    ? (req.body.ids as unknown[]).filter((id): id is string => typeof id === 'string')
    : [];
  const olderThanHours = Number(req.body?.olderThanHours || 0);
  const beforeTime = olderThanHours > 0 ? Date.now() - olderThanHours * 60 * 60 * 1000 : null;
  let deleted = 0;

  for (let index = notifications.length - 1; index >= 0; index -= 1) {
    const notification = notifications[index];
    if (!visibleIds.has(notification.id)) continue;

    const selectedMatch = ids.includes(notification.id);
    const ageMatch = beforeTime !== null && new Date(notification.createdAt).getTime() <= beforeTime;
    if (selectedMatch || ageMatch) {
      if (!userHasProjectPermission(notification.projectId, user, 'notification:update')) {
        deny(res);
        return;
      }
      notifications.splice(index, 1);
      deleted += 1;
    }
  }

  if (deleted > 0) saveAppState();
  res.json({ deleted });
});

app.delete('/api/notifications/:id', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  const visibleIds = visibleNotificationIdsForUser(user);
  if (!visibleIds.has(req.params.id)) {
    res.status(404).json({ message: 'Notification not found' });
    return;
  }
  const index = notifications.findIndex((notification) => notification.id === req.params.id);
  if (index >= 0 && !userHasProjectPermission(notifications[index].projectId, user, 'notification:update')) {
    deny(res);
    return;
  }
  if (index >= 0) notifications.splice(index, 1);
  saveAppState();
  res.status(204).send();
});

app.get('/api/notifications/unread-count', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  const visibleProjectIds = new Set(visibleProjectsForUser(user).map((project) => project.id));
  res.json({ count: notifications.filter((notification) => !notification.read && (notification.userId === user.id || visibleProjectIds.has(notification.projectId))).length });
});

app.patch('/api/notifications/preferences', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  res.json({ ok: true, preferences: req.body || {} });
});

app.get('/api/team/:projectId', (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }
  ensureProjectOwner(project.id);
  const user = requireRequestUser(req, res);
  if (!user) return;
  if (!userHasProjectPermission(project.id, user, 'team:view')) {
    deny(res);
    return;
  }
  const projectMembers = teamMembers
    .filter((member) => member.projectId === req.params.projectId && member.status !== 'removed')
    .map(normalizeTeamMember);
  res.json(projectMembers);
});

app.post('/api/team/:projectId/invite', async (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }
  const inviter = requireProjectPermission(req, res, project.id, 'team:invite');
  if (!inviter) return;

  const role = ['admin', 'member', 'viewer'].includes(req.body?.role) ? req.body.role : 'viewer';
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) {
    res.status(400).json({ message: 'Email is required' });
    return;
  }
  const token = crypto.randomBytes(16).toString('hex');
  const invitePassword = generateInvitePassword();
  const invite: TeamInvite = {
    id: uuidv4(),
    token,
    projectId: project.id,
    userEmail: email,
    invitedByName: inviter.name,
    invitedByEmail: inviter.email,
    role,
    inviteLink: createInviteLink(token),
    invitePassword,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now(),
  };
  teamInvites.push(invite);
  const existingMember = teamMembers.find(
    (member) => member.projectId === project.id && member.userEmail.toLowerCase() === email
  );
  if (existingMember) {
    existingMember.userId = userForEmail(email)?.id || existingMember.userId;
    existingMember.role = role;
    existingMember.status = existingMember.status === 'active' || existingMember.status === 'joined' ? 'active' : 'pending';
    existingMember.invitedBy = inviter.id;
    existingMember.invitedAt = now();
    existingMember.updatedAt = now();
    existingMember.inviteLink = invite.inviteLink;
    existingMember.invitePassword = invite.invitePassword;
    existingMember.inviteExpiresAt = invite.expiresAt;
  } else {
    const timestamp = now();
    teamMembers.push({
      id: uuidv4(),
      userId: userForEmail(email)?.id,
      projectId: project.id,
      userEmail: email,
      name: email.split('@')[0],
      role,
      invitedBy: inviter.id,
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp,
      invitedAt: timestamp,
      inviteLink: invite.inviteLink,
      invitePassword: invite.invitePassword,
      inviteExpiresAt: invite.expiresAt,
    });
  }
  project.memberCount = teamMembers.filter((item) => item.projectId === project.id && item.status !== 'removed').length;
  createNotification(project.id, 'team', 'Team member invited', `${invite.userEmail} was invited as ${invite.role}.`);
  let emailDelivery: AlertDelivery | undefined;
  try {
    emailDelivery = await sendInvitationEmail(invite.userEmail, invite, project.name);
  } catch (error) {
    console.error('Invitation email failed', {
      to: invite.userEmail,
      projectId: project.id,
      error: error instanceof Error ? error.message : error,
    });
  }
  res.status(201).json({ ...invite, emailDelivery });
});

app.get('/api/team/invite/:token', (req, res) => {
  const invite = teamInvites.find((item) => item.token === req.params.token);
  if (!invite) {
    res.status(404).json({ message: 'Invite not found or already used' });
    return;
  }
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    res.status(410).json({ message: 'Invite has expired' });
    return;
  }
  const project = projects.find((item) => item.id === invite.projectId);
  res.json({
    projectName: project?.name || 'DriftBoard Project',
    email: invite.userEmail,
    role: invite.role,
    expiresAt: invite.expiresAt,
  });
});

app.post('/api/team/invite/:token/accept', (req, res) => {
  const inviteIndex = teamInvites.findIndex((item) => item.token === req.params.token);
  const invite = teamInvites[inviteIndex];
  if (!invite) {
    res.status(404).json({ message: 'Invite not found or already used' });
    return;
  }
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    teamInvites.splice(inviteIndex, 1);
    res.status(410).json({ message: 'Invite has expired' });
    return;
  }
  if (String(req.body?.password || '').trim().toUpperCase() !== invite.invitePassword) {
    res.status(400).json({ message: 'Invite password is incorrect' });
    return;
  }
  const project = projects.find((item) => item.id === invite.projectId);
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }

  const existingUser = findUserByEmail(invite.userEmail);
  const invitedUser = upsertUser({
    ...(existingUser || {}),
    id: existingUser?.id || uuidv4(),
    email: invite.userEmail,
    username: existingUser?.username || usernameFrom(invite.userEmail),
    name: existingUser?.name || invite.userEmail.split('@')[0],
    role: existingUser?.role || invite.role,
    authProvider: existingUser?.authProvider || 'password',
    passwordHash: existingUser?.passwordHash || bcrypt.hashSync(invite.invitePassword, 10),
  } as User);

  let member = teamMembers.find(
    (item) => item.projectId === invite.projectId && item.userEmail.toLowerCase() === invite.userEmail.toLowerCase()
  );
  if (member) {
    member.userId = invitedUser.id;
    member.role = invite.role;
    member.status = 'active';
    member.joinedAt = now();
    member.updatedAt = now();
    member.name = invitedUser.name;
    member.inviteLink = undefined;
    member.invitePassword = undefined;
    member.inviteExpiresAt = undefined;
  } else {
    member = {
      id: uuidv4(),
      userId: invitedUser.id,
      projectId: invite.projectId,
      userEmail: invite.userEmail,
      name: invitedUser.name,
      role: invite.role,
      status: 'active',
      createdAt: now(),
      updatedAt: now(),
      joinedAt: now(),
    };
    teamMembers.push(member);
  }
  project.memberCount = teamMembers.filter((item) => item.projectId === project.id && item.status !== 'removed').length;

  setActiveUser(invitedUser);
  teamInvites.splice(inviteIndex, 1);
  createNotification(invite.projectId, 'team', 'Team member joined', `${invite.userEmail} joined ${project.name}.`);
  res.json({ user: publicUser(invitedUser), token: issueToken(invitedUser), project: projectForUser(project, invitedUser) });
});

app.put('/api/team/member/:id', (req, res) => {
  const member = teamMembers.find((item) => item.id === req.params.id);
  if (!member) {
    res.status(404).json({ message: 'Team member not found' });
    return;
  }
  const user = requireProjectPermission(req, res, member.projectId, 'team:role:update');
  if (!user) return;
  const nextRole = req.body?.role;
  if (!['admin', 'member', 'viewer'].includes(nextRole)) {
    res.status(400).json({ message: 'Valid member role is required' });
    return;
  }
  if (member.role === 'owner') {
    deny(res);
    return;
  }
  if (member.role === 'admin' && nextRole !== 'admin' && projectAdmins(member.projectId, member.id).length === 0) {
    res.status(400).json({ message: 'Make another member admin before changing this admin role' });
    return;
  }
  const project = projects.find((item) => item.id === member.projectId);
  const memberUser = userForEmail(member.userEmail);
  if (project?.ownerId === memberUser?.id) {
    deny(res);
    return;
  }
  member.role = nextRole;
  member.updatedAt = now();
  createNotification(member.projectId, 'team', 'Team role updated', `${member.userEmail} is now ${member.role}.`);
  res.json(normalizeTeamMember(member));
});

app.delete('/api/team/member/:id', (req, res) => {
  const index = teamMembers.findIndex((member) => member.id === req.params.id);
  if (index >= 0) {
    const member = teamMembers[index];
    const user = requireProjectPermission(req, res, member.projectId, 'team:remove');
    if (!user) return;
    const project = projects.find((item) => item.id === member.projectId);
    const memberUser = userForEmail(member.userEmail);
    if (member.role === 'owner' || project?.ownerId === memberUser?.id) {
      deny(res);
      return;
    }
    if (member.role === 'admin' && projectAdmins(member.projectId, member.id).length === 0) {
      res.status(400).json({ message: 'Make another member admin before removing this admin' });
      return;
    }
    teamMembers[index].status = 'removed';
    teamMembers[index].updatedAt = now();
    if (project) {
      project.memberCount = teamMembers.filter((item) => item.projectId === project.id && item.status !== 'removed').length;
    }
  }
  res.status(204).send();
});

app.post('/api/team/invite-link', (req, res) => {
  const projectId = String(req.body?.projectId || '');
  const project = projects.find((item) => item.id === projectId);
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }
  const user = requireProjectPermission(req, res, project.id, 'team:invite');
  if (!user) return;
  const token = crypto.randomBytes(16).toString('hex');
  const invitePassword = generateInvitePassword();
  res.json({
    token,
    inviteLink: createInviteLink(token),
    invitePassword,
    projectId: req.body?.projectId,
    role: req.body?.role || 'viewer',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
});

app.get('/api/settings/notification-channels', (req, res) => {
  const user = requireRequestUser(req, res);
  if (!user) return;
  res.json({ ...notificationChannels, emailConfig: emailConfigStatus() });
});

app.put('/api/settings/notification-channels', (req, res) => {
  const projectId = String(req.body?.projectId || '');
  if (projectId) {
    const user = requireProjectPermission(req, res, projectId, 'notification:update');
    if (!user) return;
  } else {
    const user = requireRequestUser(req, res);
    if (!user) return;
    if (!['owner', 'admin'].includes(user.role)) {
      deny(res);
      return;
    }
  }
  const discord = req.body?.discord || {};
  const email = req.body?.email || {};
  const nextEmailAddress = typeof email.address === 'string' && email.address.trim() ? email.address.trim().toLowerCase() : demoUser.email;
  if (Boolean(email.enabled) && !isValidEmailAddress(nextEmailAddress)) {
    console.warn('Invalid recipient', { email: nextEmailAddress });
    res.status(400).json({ message: 'Enter a valid alert email address.' });
    return;
  }
  notificationChannels.discord = {
    enabled: Boolean(discord.enabled),
    webhookUrl: typeof discord.webhookUrl === 'string' ? discord.webhookUrl.trim() : notificationChannels.discord.webhookUrl,
  };
  notificationChannels.email = {
    enabled: Boolean(email.enabled),
    address: nextEmailAddress,
  };
  res.json({ ...notificationChannels, emailConfig: emailConfigStatus() });
});

async function sendTestAlertHandler(req: Request, res: Response) {
  const project = projects.find((item) => item.id === req.body?.projectId);
  if (project) {
    const user = requireProjectPermission(req, res, project.id, 'scan:run');
    if (!user) return;
  } else {
    const user = requireRequestUser(req, res);
    if (!user) return;
  }
  const endpoint = endpoints.find((item) => item.projectId === project?.id);
  const driftEvent: DriftEvent = {
    id: 'test-drift-preview',
    endpointId: endpoint?.id || 'test-endpoint',
    endpointName: endpoint?.name || 'Checkout API',
    projectId: project?.id || 'project_demo',
    projectName: project?.name || 'Demo Project',
    severity: 'breaking',
    status: 'new',
    detectedAt: now(),
    message: 'Test preview: response.email changed from required string to optional string.',
    changes: [
      { path: 'response.email', field: 'email', expected: 'required string', actual: 'optional string', type: 'modified' },
      { path: 'response.customer.tier', field: 'tier', expected: undefined, actual: 'string', type: 'added' },
    ],
  };
  const title = 'Schema Drift Alert Preview';
  const message = driftEvent.message;
  const context: AlertContext = { endpoint, driftEvent, changes: driftEvent.changes, severity: driftEvent.severity };
  const delivered: AlertDelivery[] = [];

  try {
    if (notificationChannels.discord.enabled) {
      if (!notificationChannels.discord.webhookUrl) {
        res.status(400).json({ message: 'Discord webhook URL is required' });
        return;
      }
      delivered.push(await sendDiscordAlert(title, message, driftEvent.projectId, 'drift', context));
    }

    if (notificationChannels.email.enabled) {
      if (!notificationChannels.email.address) {
        res.status(400).json({ message: 'Email address is required' });
        return;
      }
      const summary = alertSummary(title, message, driftEvent.projectId, 'drift', context);
      delivered.push(await sendTestAlertEmail(notificationChannels.email.address, summary));
      createNotification(req.body?.projectId || 'project_demo', 'system', 'Test email sent', `Test email sent to ${notificationChannels.email.address}.`, false);
    }

    if (delivered.length === 0) {
      res.status(400).json({ message: 'Choose Discord or Email before sending a test alert' });
      return;
    }

    res.json({ delivered, message });
  } catch (error) {
    res.status(502).json({ message: error instanceof Error ? error.message : 'Could not send alert' });
  }
}

app.post('/api/settings/test-alert', testEmailLimiter, sendTestAlertHandler);
app.post('/api/test-email', testEmailLimiter, sendTestAlertHandler);

app.get('/api/projects/:projectId/api-keys', (req, res) => {
  const user = requireProjectPermission(req, res, req.params.projectId, 'api_key:view');
  if (!user) return;
  res.json(apiKeys.filter((key) => key.projectId === req.params.projectId).map((key) => publicApiKey(key)));
});

app.post('/api/projects/:projectId/api-keys', (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }
  const user = requireProjectPermission(req, res, project.id, 'api_key:create');
  if (!user) return;
  const name = String(req.body?.name || 'API Key');
  const scopes = Array.isArray(req.body?.scopes) && req.body.scopes.length > 0 ? req.body.scopes : ['read:schema'];
  res.status(201).json(publicApiKey(createApiKey(project.id, name, scopes), true));
});

app.post('/api/api-keys/:id/rotate', (req, res) => {
  const key = apiKeys.find((item) => item.id === req.params.id);
  if (!key) {
    res.status(404).json({ message: 'API key not found' });
    return;
  }
  const user = requireProjectPermission(req, res, key.projectId, 'api_key:update');
  if (!user) return;
  if (key.status === 'revoked') {
    res.status(400).json({ message: 'Revoked API keys cannot be rotated' });
    return;
  }
  const fullKey = `db_live_${crypto.randomBytes(18).toString('hex')}`;
  key.name = rotatedKeyName(key.name);
  key.keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
  key.keyPrefix = `${fullKey.slice(0, 12)}...${fullKey.slice(-4)}`;
  key.status = 'active';
  key.createdAt = now();
  key.revokedAt = undefined;
  key.fullKey = fullKey;
  createNotification(key.projectId, 'system', 'API key rotated', `${key.name} was rotated.`);
  res.json(publicApiKey(key, true));
});

app.post('/api/api-keys/:id/revoke', (req, res) => {
  const key = apiKeys.find((item) => item.id === req.params.id);
  if (!key) {
    res.status(404).json({ message: 'API key not found' });
    return;
  }
  const user = requireProjectPermission(req, res, key.projectId, 'api_key:update');
  if (!user) return;
  key.status = 'revoked';
  key.revokedAt = now();
  createNotification(key.projectId, 'system', 'API key revoked', `${key.name} has been revoked.`);
  res.json(publicApiKey(key));
});

app.patch('/api/api-keys/:id', (req, res) => {
  const key = apiKeys.find((item) => item.id === req.params.id);
  if (!key) {
    res.status(404).json({ message: 'API key not found' });
    return;
  }
  const user = requireProjectPermission(req, res, key.projectId, 'api_key:update');
  if (!user) return;
  const name = String(req.body?.name || '').trim();
  const scopes = Array.isArray(req.body?.scopes)
    ? (req.body.scopes as unknown[]).filter((scope): scope is string => typeof scope === 'string')
    : null;
  if (!name) {
    res.status(400).json({ message: 'Key name is required' });
    return;
  }
  key.name = name;
  if (scopes && scopes.length > 0) key.scopes = scopes;
  createNotification(key.projectId, 'system', 'API key updated', `${key.name} was updated.`);
  res.json(publicApiKey(key));
});

app.delete('/api/api-keys/:id', (req, res) => {
  const index = apiKeys.findIndex((key) => key.id === req.params.id);
  if (index >= 0) {
    const user = requireProjectPermission(req, res, apiKeys[index].projectId, 'api_key:update');
    if (!user) return;
  }
  if (index >= 0) apiKeys.splice(index, 1);
  res.status(204).send();
});

app.get('/api/projects/:projectId/graph-data', (req, res) => {
  const user = requireProjectPermission(req, res, req.params.projectId, 'report:view');
  if (!user) return;
  const project = projects.find((item) => item.id === req.params.projectId);
  const projectEndpoints = endpoints.filter((endpoint) => endpoint.projectId === req.params.projectId);
  const logs = monitoringLogs.filter((log) => log.projectId === req.params.projectId).slice(0, 30).reverse();
  const activity = [
    ...(project ? [
      { type: 'project_created', label: 'Project connected', createdAt: project.createdAt },
      { type: 'project_updated', label: 'Project updated', createdAt: project.updatedAt },
    ] : []),
    ...projectEndpoints.flatMap((endpoint) => [
      { type: 'endpoint_created', label: `${endpoint.method} ${endpoint.url}`, createdAt: endpoint.createdAt },
      { type: 'endpoint_updated', label: `${endpoint.method} ${endpoint.url}`, createdAt: endpoint.updatedAt },
      ...(endpoint.lastCheckedAt ? [{ type: 'endpoint_checked', label: `${endpoint.name} checked`, createdAt: endpoint.lastCheckedAt }] : []),
      ...(endpoint.lastDriftAt ? [{ type: 'drift_detected', label: `${endpoint.name} drifted`, createdAt: endpoint.lastDriftAt }] : []),
      ...endpoint.schemaVersions.map((version) => ({
        type: 'schema_version',
        label: `${endpoint.name} schema v${version.version}`,
        createdAt: version.createdAt,
      })),
    ]),
    ...uploadedFiles
      .filter((file) => file.projectId === req.params.projectId)
      .map((file) => ({ type: 'file_uploaded', label: file.originalName, createdAt: file.uploadedAt })),
    ...driftEvents
      .filter((event) => event.projectId === req.params.projectId)
      .map((event) => ({ type: 'drift_event', label: event.message, createdAt: event.detectedAt })),
    ...notifications
      .filter((notification) => notification.projectId === req.params.projectId)
      .map((notification) => ({ type: 'notification', label: notification.title, createdAt: notification.createdAt })),
    ...apiKeys
      .filter((key) => key.projectId === req.params.projectId)
      .map((key) => ({ type: 'api_key', label: key.name, createdAt: key.createdAt })),
    ...teamMembers
      .filter((member) => member.projectId === req.params.projectId)
      .flatMap((member) => [
        ...(member.invitedAt ? [{ type: 'team_invited', label: member.userEmail, createdAt: member.invitedAt }] : []),
        ...(member.joinedAt ? [{ type: 'team_joined', label: member.userEmail, createdAt: member.joinedAt }] : []),
      ]),
    ...logs.map((log) => ({ type: 'monitoring_check', label: log.success ? 'Monitoring check passed' : 'Monitoring check failed', createdAt: log.createdAt })),
  ]
    .filter((item) => Boolean(item.createdAt))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  res.json({
    responseTimes: logs.map((log) => ({ time: log.createdAt, value: log.responseTime })),
    health: projectEndpoints
      .map((endpoint) => ({ endpoint: endpoint.name, value: endpoint.health })),
    events: driftEvents.filter((event) => event.projectId === req.params.projectId),
    activity,
  });
});

app.get('/api/projects/:projectId/report', (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }
  const user = requireProjectPermission(req, res, project.id, 'report:view');
  if (!user) return;
  const projectEndpoints = endpoints.filter((endpoint) => endpoint.projectId === project.id);
  const projectDrifts = driftEvents.filter((event) => event.projectId === project.id);
  createNotification(project.id, 'system', 'Report generated', `${project.name} monitoring report was generated.`);
  res.json({
    project,
    generatedAt: now(),
    summary: {
      endpoints: projectEndpoints.length,
      unresolvedDrifts: projectDrifts.filter((event) => !['resolved', 'ignored'].includes(event.status)).length,
      averageResponseTime:
        projectEndpoints.reduce((total, endpoint) => total + endpoint.responseTime, 0) / Math.max(projectEndpoints.length, 1),
      apiHealth: Math.round(projectEndpoints.reduce((total, endpoint) => total + endpoint.health, 0) / Math.max(projectEndpoints.length, 1)),
    },
    endpoints: projectEndpoints,
    driftEvents: projectDrifts,
  });
});

io.on('connection', (socket) => {
  socket.emit('drift:new', driftEvents[0]);
  socket.on('project:join', ({ projectId }) => socket.join(`project:${projectId}`));
  socket.on('project:leave', ({ projectId }) => socket.leave(`project:${projectId}`));
});

const monitoringTimer = setInterval(() => {
  endpoints
    .filter((endpoint) => endpoint.monitoringEnabled !== false)
    .filter((endpoint) => {
      const project = projects.find((item) => item.id === endpoint.projectId);
      return project && ['active', 'connected', 'monitoring'].includes(project.monitoringStatus);
    })
    .forEach((endpoint) => {
      const interval = frequencyToMs(endpoint.frequency);
      const lastRun = lastAutoRefreshAt.get(endpoint.id) || 0;
      if (Date.now() - lastRun < interval) return;
      lastAutoRefreshAt.set(endpoint.id, Date.now());

      void (async () => {
        try {
          const response = await fetchEndpointResponse(endpoint);
          const log = addMonitoringLog(endpoint, response.statusCode, response.responseTime, response.ok, response.ok ? undefined : `Endpoint returned ${response.statusCode}`);
          endpoint.responseTime = response.responseTime;
          endpoint.lastCheckedAt = now();
          endpoint.updatedAt = endpoint.lastCheckedAt;

          if (!response.ok) {
            endpoint.status = 'failed';
            endpoint.health = 15;
            const notification = createEndpointFailureIncident(endpoint, `Endpoint returned HTTP ${response.statusCode}`);
            io.emit('endpoint:checked', { endpoint, log, notification, changed: false, failure: true });
            return;
          }

          resolveEndpointFailureIncident(endpoint);
          const latestSchema = inferSchema(response.body);
          if (endpoint.currentSchemaVersion < 1 || endpoint.schemaVersions.length === 0) {
            const schemaVersion = {
              id: uuidv4(),
              endpointId: endpoint.id,
              version: 1,
              schema: latestSchema,
              createdAt: now(),
              createdBy: 'Monitoring engine',
              changelog: 'Baseline schema captured from first successful response',
            };
            endpoint.schemaVersions.push(schemaVersion);
            endpoint.currentSchema = latestSchema;
            endpoint.currentSchemaVersion = 1;
            endpoint.status = 'healthy';
            endpoint.health = Math.max(90, 100 - Math.floor(response.responseTime / 80));
            const notification = createNotification(endpoint.projectId, 'schema', 'Baseline Schema Captured', `${endpoint.name} first successful response was saved as Version 1.`, false, { endpoint, severity: 'low' });
            io.emit('endpoint:checked', { endpoint, log, schemaVersion, notification, changed: false });
            return;
          }

          const comparison = compareSchemas(endpoint.currentSchema, latestSchema);
          if (!comparison.changes.length) {
            endpoint.status = endpoint.status === 'drifted' ? 'drifted' : 'healthy';
            endpoint.health = Math.max(90, 100 - Math.floor(response.responseTime / 80));
            io.emit('endpoint:checked', { endpoint, log, changed: false });
            return;
          }

          const version = endpoint.currentSchemaVersion + 1;
          const schemaVersion = {
            id: uuidv4(),
            endpointId: endpoint.id,
            version,
            schema: latestSchema,
            createdAt: now(),
            createdBy: 'Monitoring engine',
            changelog: comparison.changes.map(formatSchemaChange).join(', '),
          };
          endpoint.schemaVersions.push(schemaVersion);
          endpoint.currentSchema = latestSchema;
          endpoint.currentSchemaVersion = version;
          endpoint.status = 'drifted';
          endpoint.health = comparison.severity === 'breaking' ? 62 : 78;
          endpoint.lastDriftAt = now();

          const event: DriftEvent = {
            id: uuidv4(),
            endpointId: endpoint.id,
            endpointName: endpoint.name,
            projectId: endpoint.projectId,
            projectName: projects.find((project) => project.id === endpoint.projectId)?.name || 'Project',
            severity: comparison.severity,
            status: 'new',
            detectedAt: now(),
            message: `${endpoint.name} changed: ${comparison.changes.map(formatSchemaChange).join(', ')}`,
            changes: comparison.changes,
          };
          driftEvents.unshift(event);
          const notification = createNotification(endpoint.projectId, 'drift', 'API Drift Detected', event.message, true, { endpoint, driftEvent: event, changes: event.changes, severity: event.severity });
          createNotification(endpoint.projectId, 'schema', `Schema Version ${version} created`, `${endpoint.name} changed to Version ${version}.`, false, { endpoint, driftEvent: event, changes: event.changes, severity: event.severity });
          io.emit('drift:new', event);
          io.emit('endpoint:checked', { endpoint, log, schemaVersion, event, notification, changed: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Endpoint fetch failed';
          endpoint.status = 'failed';
          endpoint.health = 10;
          endpoint.lastCheckedAt = now();
          endpoint.updatedAt = endpoint.lastCheckedAt;
          const log = addMonitoringLog(endpoint, 0, 0, false, message);
          const notification = createEndpointFailureIncident(endpoint, message);
          io.emit('endpoint:checked', { endpoint, log, notification, changed: false, failure: true });
        } finally {
          saveAppState();
        }
      })();
    });
}, 1000);

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

httpServer.listen(PORT, () => {
  console.log(`DriftBoard backend running on http://localhost:${PORT}`);
});

function shutdownBackend(signal: NodeJS.Signals) {
  clearInterval(monitoringTimer);
  saveAppState();
  httpServer.close(() => {
    process.kill(process.pid, signal);
  });
}

process.once('SIGUSR2', () => shutdownBackend('SIGUSR2'));
process.once('SIGINT', () => shutdownBackend('SIGINT'));
process.once('SIGTERM', () => shutdownBackend('SIGTERM'));
