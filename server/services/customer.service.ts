import type { SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import type { Database } from '../../types/database.types'
import { canPromoteProfile } from '../../utils/auth'
import { accountEmails } from '../utils/account-email'
import { isPlaceholderBookingEmail } from '../utils/placeholder-booking-email'
import { countOpenRentalsForProfile, listCustomers } from '../repositories/customer.repository'
import {
  countActiveAdmins,
  findProfileByUuid,
  findProfileForDeletion,
  listAdminProfiles,
  markProfileDeleted,
  listCommissionerProfiles,
  promoteProfileToAdmin,
  promoteProfileToCommissioner,
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
  const emails = await accountEmails(rows.map(row => row.user_id))

  return {
    items: rows.map((row) => {
      const email = emails.get(row.user_id) || null
      const walkIn = isPlaceholderBookingEmail(email)
      return {
        uuid: row.uuid,
        firstName: row.first_name,
        lastName: row.last_name,
        email: walkIn ? null : email,
        walkIn,
        phone: row.phone,
        rentalCount: rentalCount(row.rental_requests),
        createdAt: row.created_at,
      }
    }),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function listAdminSystemUsers(client: Client) {
  const rows = await listAdminProfiles(client)
  const emails = await accountEmails(rows.map(row => row.user_id))

  return rows.map(row => ({
    uuid: row.uuid,
    firstName: row.first_name,
    lastName: row.last_name,
    email: emails.get(row.user_id) || null,
    createdAt: row.created_at,
  }))
}

export async function listAdminCommissioners(client: Client) {
  const rows = await listCommissionerProfiles(client)
  const emails = await accountEmails(rows.map(row => row.user_id))

  return rows.map(row => ({
    uuid: row.uuid,
    firstName: row.first_name,
    lastName: row.last_name,
    email: emails.get(row.user_id) || null,
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

export async function deleteAdminProfile(
  event: H3Event,
  client: Client,
  actor: { uuid: string, profileId: number },
  profileUuid: string,
) {
  const target = await findProfileForDeletion(client, profileUuid)
  if (!target || target.deleted_at) {
    throw new AppError('Account not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  if (target.uuid === actor.uuid) {
    throw new AppError('You cannot delete your own account.', 409, ERROR_CODES.CONFLICT)
  }

  if (target.role === 'admin' && await countActiveAdmins(client) <= 1) {
    throw new AppError('Keep at least one system user.', 409, ERROR_CODES.CONFLICT)
  }

  const openRentals = await countOpenRentalsForProfile(client, target.id)
  if (openRentals > 0) {
    throw new AppError(
      `This account still has ${openRentals} open booking${openRentals === 1 ? '' : 's'}. Cancel or finish ${openRentals === 1 ? 'it' : 'them'} first.`,
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  const ban = await client.auth.admin.updateUserById(target.user_id, { ban_duration: '876000h' })
  if (ban.error) {
    throw new AppError('We could not disable that sign-in.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: ban.error })
  }

  await markProfileDeleted(client, target.uuid, actor.profileId)
  await recordAudit(event, client, {
    action: 'profile.delete',
    entity: 'profiles',
    entityId: target.uuid,
    previous: {
      role: target.role,
      firstName: target.first_name,
      lastName: target.last_name,
    },
    next: { deleted: true },
  })

  return { deleted: true, uuid: target.uuid }
}

export async function promoteCommissionerCustomer(
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
      target.role === 'commissioner'
        ? 'That account is already a commissioner.'
        : 'You cannot change that account.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  await promoteProfileToCommissioner(client, target.uuid)
  await recordAudit(event, client, {
    action: 'profile.promote_commissioner',
    entity: 'profiles',
    entityId: target.uuid,
    previous: { role: target.role },
    next: { role: 'commissioner' },
  })

  return {
    uuid: target.uuid,
    firstName: target.first_name,
    lastName: target.last_name,
    role: 'commissioner' as const,
  }
}
