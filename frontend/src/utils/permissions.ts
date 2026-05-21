export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export type ProjectPermission =
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

export const projectPermissionRoles: Record<ProjectPermission, ProjectRole[]> = {
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

export function hasProjectPermission(role: ProjectRole | null | undefined, permission: ProjectPermission) {
  return Boolean(role && projectPermissionRoles[permission].includes(role));
}
