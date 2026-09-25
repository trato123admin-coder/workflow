import { createClient } from './server';

export interface ServerAuditParams {
  userId?: string | null;
  module: string;
  entityType: string;
  entityId?: string | null;
  action: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Inserta un evento inmutable en public.audit_logs invocando private.log_audit_event()
 */
export async function logServerAuditEvent(params: ServerAuditParams): Promise<string | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('log_audit_event', {
      _user_id: params.userId ?? null,
      _module: params.module,
      _entity_type: params.entityType,
      _entity_id: params.entityId ?? null,
      _action: params.action,
      _old_data: params.oldData ?? null,
      _new_data: params.newData ?? null,
      _ip_address: params.ipAddress ?? null,
      _user_agent: params.userAgent ?? null,
    });

    if (error) {
      // Fallback direct insert if RPC fails or permissions allow
      const { data: insertData } = await supabase
        .from('audit_logs')
        .insert({
          user_id: params.userId ?? null,
          module: params.module,
          entity_type: params.entityType,
          entity_id: params.entityId ?? null,
          action: params.action,
          old_data: params.oldData ?? null,
          new_data: params.newData ?? null,
          user_agent: params.userAgent ?? null,
        })
        .select('id')
        .single();

      return insertData?.id ?? null;
    }

    return data as string;
  } catch {
    return null;
  }
}
