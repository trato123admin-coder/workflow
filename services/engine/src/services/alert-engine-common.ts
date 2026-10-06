/**
 * alert-engine-common.ts — Common helpers and dispatchers for domain alert engines.
 *
 * Sprint 8 (S8-04):
 * - Peru timezone resolution (America/Lima, UTC-5)
 * - Safe notification dispatch via create_notification RPC
 * - Active case assignee resolution (Responsible, Lawyer)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildNotificationDedupeKey } from '@workflow/shared';

import type { FastifyBaseLogger } from 'fastify';
import type { ConsoleLikeLogger } from './jobs-worker.js';

export interface AlertNotificationParams {
  userId: string;
  title: string;
  body: string;
  notificationType: string;
  severity?: 'info' | 'warning' | 'critical';
  caseId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  dedupeKey?: string | null;
}

export interface CaseAssignees {
  responsibleUserId?: string;
  lawyerUserId?: string;
  collaboratorIds: string[];
  allAssigneeIds: string[];
}

export class NotificationRpcError extends Error {
  constructor(public readonly code: string) {
    super(`Fallo en notificación RPC [${code}]`);
    this.name = 'NotificationRpcError';
  }
}

export function getTodayLima(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

export async function sendAlertNotification(
  supabase: SupabaseClient,
  params: AlertNotificationParams,
  logger?: FastifyBaseLogger | ConsoleLikeLogger,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('create_notification', {
    p_user_id: params.userId,
    p_type: params.notificationType,
    p_title: params.title,
    p_body: params.body,
    p_entity_type: params.entityType ?? null,
    p_entity_id: params.entityId ?? null,
    p_case_id: params.caseId ?? null,
    p_action_url: params.actionUrl ?? null,
    p_severity: params.severity ?? 'info',
    p_channel: 'APP',
    p_dedupe_key: params.dedupeKey ?? null,
    p_metadata: params.metadata ?? {},
  });

  if (error) {
    const errorCode = error.code ?? 'RPC_ERROR';
    logger?.error(
      { code: errorCode, notificationType: params.notificationType },
      'Fallo en create_notification RPC',
    );
    throw new NotificationRpcError(errorCode);
  }

  // Devuelve true solo si la RPC insertó una fila con ID válido (comprueba data?.id, no solo data no nulo)
  const insertedId = (data as { id?: string | null } | null)?.id;
  return typeof insertedId === 'string' && insertedId.length > 0;
}

export async function getCaseAssignees(
  supabase: SupabaseClient,
  caseId: string,
): Promise<CaseAssignees> {
  const { data, error } = await supabase
    .from('case_assignments')
    .select('user_id, assignment_type, is_primary')
    .eq('case_id', caseId)
    .is('ended_at', null);

  if (error) {
    throw new Error(`Fallo al consultar asignaciones del caso [${error.code ?? 'DB_ERROR'}]`);
  }

  const assignments = data ?? [];
  let responsibleUserId: string | undefined;
  let lawyerUserId: string | undefined;
  const collaboratorIds: string[] = [];
  const allAssigneeIds: string[] = [];

  for (const a of assignments) {
    allAssigneeIds.push(a.user_id as string);
    if (a.assignment_type === 'LAWYER') {
      lawyerUserId = a.user_id as string;
    } else if (a.assignment_type === 'RESPONSIBLE' || a.is_primary) {
      responsibleUserId = a.user_id as string;
    } else if (a.assignment_type === 'COLLABORATOR') {
      collaboratorIds.push(a.user_id as string);
    }
  }

  return { responsibleUserId, lawyerUserId, collaboratorIds, allAssigneeIds };
}

export function buildDedupe(
  type: string,
  entityId: string,
  recipientUserId: string,
  today: string = getTodayLima(),
): string {
  return buildNotificationDedupeKey(type, entityId, recipientUserId, today);
}
