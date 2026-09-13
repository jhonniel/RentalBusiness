import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const AUDIT_SELECT = `
  uuid,
  actor_id,
  action,
  entity,
  entity_id,
  previous_value,
  new_value,
  ip_address,
  created_at
`

export async function listAuditLogs(client: Client, filters: {
  search?: string
  entity?: string
  from: number
  to: number
}) {
  let query = client
    .from('audit_logs')
    .select(AUDIT_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(filters.from, filters.to)

  if (filters.entity) {
    query = query.eq('entity', filters.entity)
  }

  if (filters.search) {
    query = query.or(`action.ilike.%${filters.search}%,entity.ilike.%${filters.search}%,entity_id.ilike.%${filters.search}%`)
  }

  const { data, error, count } = await query

  if (error) {
    throw new AppError('We could not load audit logs.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return { rows: data ?? [], total: count ?? 0 }
}
