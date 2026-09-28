import type { SupabaseClient } from '@supabase/supabase-js';
import { createDocumentError } from './documents-types.js';

export interface UserContext {
  userId: string;
  isSuperuser: boolean;
  permissionCodes: Set<string>;
}

/**
 * Decodifica el claim "aal" del payload del JWT.
 * SEGURIDAD DEFENSIVA: Esta función NUNCA debe llamarse antes de que supabase.auth.getUser(userJwt)
 * haya validado criptográficamente la firma del token; de lo contrario, un atacante podría enviar
 * un JWT no firmado o manipulado con un claim "aal": "aal2" falsificado.
 */
function decodeJwtAal(userJwt: string): string {
  try {
    const parts = userJwt.split('.');
    const payloadPart = parts[1];
    if (payloadPart) {
      const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
      if (typeof payload.aal === 'string') return payload.aal;
    }
  } catch {
    // Si no se puede decodificar, asume aal1
  }
  return 'aal1';
}

async function verifyProfileActive(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw createDocumentError('Error al consultar perfil del usuario', 500, 'PROFILE_QUERY_ERROR');
  }
  if (!profile || !profile.is_active) {
    throw createDocumentError(
      'Usuario inactivo o desactivado por el administrador',
      403,
      'FORBIDDEN_USER_INACTIVE',
    );
  }
}

/**
 * Autentica el JWT del usuario, valida que profiles.is_active sea true (Sprint 1),
 * exige MFA (aal2) si algún rol activo tiene requires_mfa = true, y resuelve permisos.
 */
export async function authenticateUser(
  supabase: SupabaseClient,
  userJwt: string,
  requiredPermission?: string | string[],
): Promise<UserContext> {
  const { data: authData, error: authError } = await supabase.auth.getUser(userJwt);
  if (authError || !authData?.user) {
    throw createDocumentError('Token de autenticación inválido o expirado', 401, 'UNAUTHORIZED');
  }

  const userId = authData.user.id;
  await verifyProfileActive(supabase, userId);

  const { data: userRolesData, error: rolesError } = await supabase
    .from('user_roles')
    .select(
      `
      roles!inner (
        id,
        is_superuser,
        is_active,
        requires_mfa,
        role_permissions (
          permissions!inner (code)
        )
      )
    `,
    )
    .eq('user_id', userId);

  if (rolesError) {
    throw createDocumentError('Error al consultar roles de usuario', 500, 'ROLES_QUERY_ERROR');
  }

  interface RoleDetail {
    is_superuser?: boolean;
    is_active?: boolean;
    requires_mfa?: boolean;
    role_permissions?: Array<{ permissions?: { code?: string } | null }>;
  }

  const activeRoles: RoleDetail[] = (userRolesData ?? [])
    .map((ur) => (ur as unknown as { roles?: RoleDetail | null }).roles)
    .filter((r): r is RoleDetail => Boolean(r?.is_active));
  const aal = decodeJwtAal(userJwt);

  if (activeRoles.some((r) => r.requires_mfa) && aal !== 'aal2') {
    throw createDocumentError(
      'Nivel de autenticación insuficiente: se requiere MFA (aal2) para los roles asignados',
      403,
      'FORBIDDEN_MFA_REQUIRED',
    );
  }

  let isSuperuser = false;
  const permissionCodes = new Set<string>();

  for (const r of activeRoles) {
    if (r.is_superuser) isSuperuser = true;
    for (const rp of r.role_permissions ?? []) {
      if (rp.permissions?.code) permissionCodes.add(rp.permissions.code);
    }
  }

  if (requiredPermission && !isSuperuser) {
    const required = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const hasAny = required.some((perm) => permissionCodes.has(perm));
    if (!hasAny) {
      throw createDocumentError(
        `Permiso insuficiente: se requiere uno de los siguientes permisos: [${required.join(', ')}]`,
        403,
        'FORBIDDEN_INSUFFICIENT_PERMISSIONS',
      );
    }
  }

  return { userId, isSuperuser, permissionCodes };
}

/**
 * Evalúa las reglas canónicas de acceso al caso reproduciendo con exactitud:
 * - private.can_access_case(_case_id) (confidencialidad, asignación, lectura)
 * - private.can_write_case(_case_id) (bloqueo estricto de VIEWER, permisos de escritura)
 */
export async function checkCaseAccess(
  supabase: SupabaseClient,
  user: UserContext,
  caseId: string,
  isConfidential: boolean,
  requireWrite = false,
): Promise<void> {
  // Superusuario tiene bypass de acceso en lectura y escritura (private.is_superuser())
  if (user.isSuperuser) return;

  const { data: assignments, error } = await supabase
    .from('case_assignments')
    .select('assignment_type')
    .eq('case_id', caseId)
    .eq('user_id', user.userId)
    .is('ended_at', null);

  if (error) {
    throw createDocumentError(
      'Error al consultar asignaciones del caso',
      500,
      'ASSIGNMENTS_QUERY_ERROR',
    );
  }

  const activeAssignments = assignments ?? [];
  const isAssigned = activeAssignments.length > 0;
  const isViewer = isAssigned && activeAssignments.every((a) => a.assignment_type === 'VIEWER');

  // Confidencialidad: caso confidencial exige obligatoriamente asignación activa al usuario
  if (isConfidential && !isAssigned) {
    throw createDocumentError(
      'Acceso denegado: el caso es confidencial y no está asignado',
      403,
      'FORBIDDEN_CONFIDENTIAL_CASE',
    );
  }

  // Regla de lectura general
  const hasRead =
    user.permissionCodes.has('cases.read.all') ||
    (user.permissionCodes.has('cases.read.assigned') && isAssigned);

  if (!hasRead) {
    throw createDocumentError('Acceso denegado al caso', 403, 'FORBIDDEN_CASE_ACCESS');
  }

  // Regla de escritura: no tener rol exclusivo VIEWER y poseer permiso cases.write
  if (requireWrite) {
    const hasWrite =
      !isViewer &&
      (user.permissionCodes.has('cases.write.all') ||
        (user.permissionCodes.has('cases.write.assigned') && isAssigned));

    if (!hasWrite) {
      throw createDocumentError(
        'No tiene permisos de modificación en este caso (asignación VIEWER o sin permiso de escritura)',
        403,
        'FORBIDDEN_CASE_WRITE',
      );
    }
  }
}

/**
 * Valida acceso a un caso verificando confidencialidad y permisos de lectura/escritura.
 */
export async function verifyCaseAccess(
  supabase: SupabaseClient,
  user: UserContext,
  caseId: string,
  options: { requireWrite?: boolean } = {},
): Promise<void> {
  const { data: caseRow, error } = await supabase
    .from('cases')
    .select('id, is_confidential')
    .eq('id', caseId)
    .maybeSingle();

  if (error || !caseRow) {
    throw createDocumentError('Expediente no encontrado', 404, 'CASE_NOT_FOUND');
  }

  await checkCaseAccess(
    supabase,
    user,
    caseId,
    Boolean(caseRow.is_confidential),
    options.requireWrite ?? false,
  );
}

/**
 * Valida autenticación, pertenencia y permisos para subir una versión de documento.
 */
export async function verifyUserUploadAccess(
  supabase: SupabaseClient,
  userJwt: string,
  caseDocumentId: string,
): Promise<{ userId: string; caseId: string }> {
  const user = await authenticateUser(supabase, userJwt);

  const { data: caseDoc, error } = await supabase
    .from('case_documents')
    .select(
      `
      id, case_id, is_active,
      cases!inner (id, is_confidential, status)
    `,
    )
    .eq('id', caseDocumentId)
    .maybeSingle();

  if (error || !caseDoc) {
    throw createDocumentError('Slot de documento no encontrado', 404, 'DOCUMENT_NOT_FOUND');
  }
  if (!caseDoc.is_active) {
    throw createDocumentError('El slot de documento está inactivo', 400, 'DOCUMENT_SLOT_INACTIVE');
  }

  if (!user.isSuperuser && !user.permissionCodes.has('documents.upload')) {
    throw createDocumentError(
      'Permiso requerido: documents.upload',
      403,
      'FORBIDDEN_DOCUMENTS_UPLOAD',
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isConfidential = Boolean((caseDoc as any).cases?.is_confidential);
  await checkCaseAccess(supabase, user, caseDoc.case_id, isConfidential, true);

  return { userId: user.userId, caseId: caseDoc.case_id };
}

/**
 * Valida autenticación, pertenencia y permisos para descargar una versión de documento.
 */
export async function verifyUserDownloadAccess(
  supabase: SupabaseClient,
  userJwt: string,
  versionId: string,
): Promise<{
  userId: string;
  versionRecord: {
    id: string;
    version: number;
    storage_backend: string;
    storage_key: string;
    file_name: string;
    size_bytes: number;
    mime_type: string;
    sha256: string;
    case_documents: { id: string; case_id: string; is_active: boolean };
  };
}> {
  const user = await authenticateUser(supabase, userJwt);

  const { data: versionRecord, error } = await supabase
    .from('document_versions')
    .select(
      `
      id, version, storage_backend, storage_key, file_name, size_bytes, mime_type, sha256,
      case_documents!inner (
        id, case_id, is_active,
        cases!inner (id, is_confidential, status)
      )
    `,
    )
    .eq('id', versionId)
    .maybeSingle();

  if (error || !versionRecord) {
    throw createDocumentError('Versión de documento no encontrada', 404, 'VERSION_NOT_FOUND');
  }

  if (!user.isSuperuser && !user.permissionCodes.has('documents.read')) {
    throw createDocumentError('Permiso requerido: documents.read', 403, 'FORBIDDEN_DOCUMENTS_READ');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caseDoc = (versionRecord as any).case_documents;
  const isConfidential = Boolean(caseDoc?.cases?.is_confidential);
  await checkCaseAccess(supabase, user, caseDoc.case_id, isConfidential, false);

  return {
    userId: user.userId,
    versionRecord: versionRecord as unknown as {
      id: string;
      version: number;
      storage_backend: string;
      storage_key: string;
      file_name: string;
      size_bytes: number;
      mime_type: string;
      sha256: string;
      case_documents: { id: string; case_id: string; is_active: boolean };
    },
  };
}
