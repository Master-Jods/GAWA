import { createServerAdminClient } from "@/lib/supabase/server";

export interface AuditLogParams {
  actorId?: string | null;
  action: string;
  entityTable: string;
  entityId?: string | null;
  details?: Record<string, any>;
}

/**
 * Append-only security audit event logger.
 * Captures actor, action, table, target entity, and structured metadata.
 */
export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    const supabase = createServerAdminClient();
    await supabase.from("admin_audit_events").insert({
      actor_id: params.actorId || null,
      action: params.action,
      entity_table: params.entityTable,
      entity_id: params.entityId ? String(params.entityId) : null,
      details: params.details || {},
    });
  } catch (err) {
    // Fail silently in production logging so as not to crash critical transaction paths,
    // but log error to server console for monitoring.
    console.error("[AuditLog Error]: Failed to write audit event:", err);
  }
}
