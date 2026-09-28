import type { SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import type { Database } from '../../types/database.types'
import { canPromoteProfile } from '../../utils/auth'
import { listCustomers } from '../repositories/customer.repository'
import {
  findProfileByUuid,
  listAdminProfiles,
  promoteProfileToAdmin,
} from '../repositories/profile.repository'
import { recordAudit } from '../utils/audit'
import { AppError, ERROR_CODES } from '../utils/errors'

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

export async function listAdminSystemUsers(client: Client) {
  const rows = await listAdminProfiles(client)

  return rows.map(row => ({
    uuid: row.uuid,
    firstName: row.first_name,
    lastName: row.last_name,
    createdAt: row.created_at,
  }))
}

export async function promoteAdminCustomer(
  event: H3Event,
  client: Client,
  actorUuid: string,
  profileUuid: string,
) {
  const target = await findProfileByUuid(client, profileUuid)

  if (!target) {
    throw new AppError('Customer not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  if (!canPromoteProfile(actorUuid, target)) {
    throw new AppError(
      target.role === 'admin'
        ? 'That account is already a system user.'
        : 'You cannot change that account.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  await promoteProfileToAdmin(client, target.uuid)
  await recordAudit(event, client, {
    action: 'profile.promote_admin',
    entity: 'profiles',
    entityId: target.uuid,
    previous: { role: target.role },
    next: { role: 'admin' },
  })

  return {
    uuid: target.uuid,
    firstName: target.first_name,
    lastName: target.last_name,
    role: 'admin' as const,
  }
}
