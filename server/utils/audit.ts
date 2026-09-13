import type { SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import type { Database, Json } from '../../types/database.types'
import { logger } from './logger'

export async function recordAudit(
  event: H3Event,
  client: SupabaseClient<Database>,
  input: {
    action: string
    entity: string
    entityId: string
    previous?: Json
    next?: Json
  },
) {
  const ip = getRequestIP(event, { xForwardedFor: true })
  const { error } = await client.rpc('write_audit_log', {
    p_action: input.action,
    p_entity: input.entity,
    p_entity_id: input.entityId,
    p_previous: input.previous ?? null,
    p_new: input.next ?? null,
    p_ip: ip ?? undefined,
    p_metadata: {},
  })

  if (error) {
    logger.warn('Audit log was not written', {
      action: input.action,
      entity: input.entity,
    })
  }
}
