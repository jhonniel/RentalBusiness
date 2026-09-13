import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { AuditLogListResponse } from '../../types/audit'
import { toPublicAuditLog } from '../../utils/audit-log'
import { listAuditLogs } from '../repositories/audit.repository'
import { listProfileActors } from '../repositories/profile.repository'

type Client = SupabaseClient<Database>

function sanitizeSearch(value?: string) {
  return value?.replace(/[%_,]/g, '').trim() || undefined
}

export async function listAdminAuditLogs(client: Client, query: {
  search?: string
  entity?: string
  page: number
  pageSize: number
}): Promise<AuditLogListResponse> {
  const from = (query.page - 1) * query.pageSize
  const { rows, total } = await listAuditLogs(client, {
    search: sanitizeSearch(query.search),
    entity: sanitizeSearch(query.entity),
    from,
    to: from + query.pageSize - 1,
  })

  const actorIds = [...new Set(rows.map(row => row.actor_id).filter((id): id is number => typeof id === 'number'))]
  const actors = await listProfileActors(client, actorIds)
  const actorsById = new Map(actors.map(actor => [actor.id, actor]))

  return {
    items: rows.map(row => toPublicAuditLog({
      ...row,
      profiles: row.actor_id ? actorsById.get(row.actor_id) ?? null : null,
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}
