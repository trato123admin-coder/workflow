/**
 * Tipos de eventos para la pista de auditoría inmutable (audit_logs)
 * Sprint 1: Identidad, seguridad y cambios de usuarios/roles
 */
export const AUDIT_ACTIONS = {
  // Autenticación
  LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  LOGIN_FAILURE: 'AUTH_LOGIN_FAILURE',
  LOGOUT: 'AUTH_LOGOUT',
  PASSWORD_RESET_REQUEST: 'AUTH_PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETE: 'AUTH_PASSWORD_RESET_COMPLETE',
  MFA_ENROLLED: 'AUTH_MFA_ENROLLED',
  MFA_VERIFIED: 'AUTH_MFA_VERIFIED',
  MFA_RESET: 'AUTH_MFA_RESET',

  // Gestión de Usuarios
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_ACTIVATED: 'USER_ACTIVATED',
  USER_ROLES_ASSIGNED: 'USER_ROLES_ASSIGNED',
  USER_SESSIONS_TERMINATED: 'USER_SESSIONS_TERMINATED',

  // Gestión de Roles y Permisos
  ROLE_CREATED: 'ROLE_CREATED',
  ROLE_UPDATED: 'ROLE_UPDATED',
  ROLE_DELETED: 'ROLE_DELETED',
  ROLE_PERMISSIONS_UPDATED: 'ROLE_PERMISSIONS_UPDATED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditLogPayload {
  userId?: string | null;
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}
