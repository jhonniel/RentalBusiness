import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { listCustomers } from '../repositories/customer.repository'

type Client = SupabaseClient<Database>

function sanitizeSearch(value?: string) {
  return value?.replace(/[%_,]/g, '').trim() || undefined
}

function rentalCount(value: unknown) {
  if (Array.isArray(value) && value[0] && typeof value[0] === 'object' && 'count' in value[0]) {
    return Number(value[0].count) || 0
  }
  return 0
}

export async function listAdminCustomers(client: Client, query: {
  search?: string
  page: number
  pageSize: number
}) {
  const from = (query.page - 1) * query.pageSize
  const { rows, total } = await listCustomers(client, {
    search: sanitizeSearch(query.search),
    from,
    to: from + query.pageSize - 1,
  })

  return {
    items: rows.map(row => ({
      uuid: row.uuid,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      rentalCount: rentalCount(row.rental_requests),
      createdAt: row.created_at,
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}
