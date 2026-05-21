export enum UserRole {
  ADMIN = 'admin',
  OWNER = 'owner',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

export enum DriftSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  BREAKING = 'breaking',
}

export enum NotificationType {
  SLACK = 'slack',
  EMAIL = 'email',
  DISCORD = 'discord',
}

export enum PlanType {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum ChangeType {
  ADDED = 'added',
  REMOVED = 'removed',
  MODIFIED = 'modified',
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  OPTIONS = 'OPTIONS',
  HEAD = 'HEAD',
}

export interface IChange {
  type: ChangeType;
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface ISchemaMetadata {
  size: number;
  fieldCount: number;
  depth: number;
}

export interface INotificationFilters {
  severities?: DriftSeverity[];
  endpointPatterns?: string[];
  projectIds?: string[];
}

export interface INotificationConfig {
  webhookUrl?: string;
  channel?: string;
  mentionUser?: string;
  fromEmail?: string;
  toEmails?: string[];
}

export interface IApiKeyPermissions {
  endpoints?: string[];
  projects?: string[];
  read?: boolean;
  write?: boolean;
  admin?: boolean;
}

export interface ITeamSettings {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface IProjectSettings {
  retentionDays?: number;
  autoRemediate?: boolean;
  diffContext?: number;
}

export interface ICreateUserDto {
  email: string;
  password: string;
  name: string;
}

export interface IUpdateUserDto {
  name?: string;
  avatar?: string;
  role?: UserRole;
}

export interface ICreateTeamDto {
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
}

export interface IUpdateTeamDto {
  name?: string;
  description?: string;
  settings?: ITeamSettings;
  plan?: PlanType;
}

export interface ICreateProjectDto {
  name: string;
  slug: string;
  description?: string;
  teamId: string;
  tags?: string[];
}

export interface IUpdateProjectDto {
  name?: string;
  description?: string;
  settings?: IProjectSettings;
  tags?: string[];
}

export interface ICreateEndpointDto {
  path: string;
  method: HttpMethod;
  projectId: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
}

export interface IUpdateEndpointDto {
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  currentSchema?: Record<string, unknown>;
}

export interface ICreateSchemaSnapshotDto {
  endpointId: string;
  schema: Record<string, unknown>;
  requestSchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  metadata?: ISchemaMetadata;
}

export interface ICreateDriftEventDto {
  endpointId: string;
  projectId: string;
  severity: DriftSeverity;
  changes: IChange[];
  diff: Record<string, unknown>;
}

export interface ICreateNotificationDto {
  userId: string;
  teamId?: string;
  type: NotificationType;
  config: INotificationConfig;
  enabled?: boolean;
  filters?: INotificationFilters;
}

export interface IUpdateNotificationDto {
  type?: NotificationType;
  config?: INotificationConfig;
  enabled?: boolean;
  filters?: INotificationFilters;
}

export interface ICreateApiKeyDto {
  key: string;
  name: string;
  projectId?: string;
  teamId?: string;
  permissions?: IApiKeyPermissions;
  expiresAt?: Date;
  createdBy: string;
}

export interface ITokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}