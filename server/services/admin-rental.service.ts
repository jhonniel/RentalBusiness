import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { AdminCalendar } from '../../types/calendar'
import type { CalendarRentalStatus, RentalStatus } from '../../utils/constants'
import { BUSINESS_TIMEZONE } from '../../utils/constants'
import { monthBounds, monthKey } from '../../utils/calendar'
import { calendarDateInZone } from '../../utils/datetime'
import { isRentalCode, toPublicRental } from '../../utils/rental'
import { canTransitionRentalStatus } from '../../utils/rental-status'
import { isUuid } from '../../utils/slug'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { STORAGE_BUCKETS } from '../../utils/storage'
import {
  deleteRentalByUuid,
  findRentalByCode,
  findRentalByUuid,
  findRentalIdentity,
  insertRentalStatusHistory,
  listRentals,
  listRentalsOverlapping,
  updateRentalStatus,
} from '../repositories/rental.repository'
import { findIdentityByRentalId } from '../repositories/identity.repository'
import { insertNotification } from '../repositories/notification.repository'
import { expireUnconfirmedRentals } from './cron.service'
import { listAdminBlockedDatesOverlapping } from './blocked-date.service'
import { attachAdminIdentityUrls } from './identity.service'

type Client = SupabaseClient<Database>

function sanitizeSearch(value?: string) {
  return value?.replace(/[%_,]/g, '').trim() || undefined
}

async function loadAdminRental(client: Client, identifier: string) {
  const row = isUuid(identifier)
    ? await findRentalByUuid(client, identifier)
    : isRentalCode(identifier)
      ? await findRentalByCode(client, identifier)
      : null

  if (!row) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const rental = toPublicRental(row)
  rental.identity = await attachAdminIdentityUrls(client, rental.uuid, rental.identity)
  return rental
}

export async function listAdminRentals(client: Client, query: {
  status?: RentalStatus
  search?: string
  page: number
  pageSize: number
}) {
  const from = (query.page - 1) * query.pageSize
  const { rows, total } = await listRentals(client, {
    status: query.status,
    search: sanitizeSearch(query.search),
    from,
    to: from + query.pageSize - 1,
  })

  return {
    items: rows.map(toPublicRental),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

function firstName(value: unknown): string | null {
  if (!value) {
    return null
  }

  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') {
    return null
  }

  const record = row as { name?: string, first_name?: string, last_name?: string }
  if (record.name) {
    return record.name
  }

  const full = [record.first_name, record.last_name].filter(Boolean).join(' ').trim()
  return full || null
}

export async function getAdminCalendar(client: Client, query: {
  month?: string
  status?: CalendarRentalStatus
}): Promise<AdminCalendar> {
  const month = query.month || monthKey(calendarDateInZone())
  const { startsOn, endsOn } = monthBounds(month)
  const rows = await listRentalsOverlapping(client, {
    startsOn,
    endsOn,
    status: query.status,
  })
  const blockedDates = await listAdminBlockedDatesOverlapping(client, startsOn, endsOn)

  return {
    month,
    startsOn,
    endsOn,
    timezone: BUSINESS_TIMEZONE,
    items: rows.map((row) => {
      const items = Array.isArray(row.rental_items) ? row.rental_items : []
      const product = firstName(items[0]?.products)

      return {
        uuid: row.uuid,
        code: row.code,
        status: row.status as CalendarRentalStatus,
        startsOn: row.starts_on,
        endsOn: row.ends_on,
        productName: product || row.code,
        customerName: firstName(row.profiles),
      }
    }),
    blockedDates,
  }
}

export async function getAdminRental(client: Client, identifier: string) {
  return loadAdminRental(client, identifier)
}

export async function confirmAdminRental(event: H3Event, client: Client, profileId: number, identifier: string) {
  await expireUnconfirmedRentals(event).catch(() => undefined)
  const rental = await loadAdminRental(client, identifier)
  if (rental.status !== 'pending') {
    throw new AppError('Confirm a submitted request first.', 409, ERROR_CODES.CONFLICT)
  }

  const fullyCovered = rental.totalAmount === 0 && Boolean(rental.voucher)
  const nextStatus: RentalStatus = fullyCovered ? 'approved' : 'awaiting_payment'
  if (!canTransitionRentalStatus(rental.status, nextStatus)) {
    throw new AppError('That rental cannot be confirmed yet.', 409, ERROR_CODES.CONFLICT)
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const row = await updateRentalStatus(client, rental.uuid, nextStatus)
  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: nextStatus,
    changedBy: profileId,
    note: fullyCovered
      ? 'Admin confirmed a fully covered booking.'
      : 'Admin confirmed the booking. Customer can pay.',
  })

  await insertNotification(client, {
    recipient_id: identity.customer_id,
    type: fullyCovered ? 'rental.approved' : 'rental.confirmed',
    title: fullyCovered ? 'Booking confirmed' : 'Booking confirmed',
    body: fullyCovered
      ? `Your rental ${rental.code} is confirmed and will be prepared for pickup.`
      : `The shop confirmed rental ${rental.code}. You can pay the down payment now.`,
    metadata: { rentalUuid: rental.uuid, rentalCode: rental.code },
  })

  const next = toPublicRental(row)
  await recordAudit(event, client, {
    action: 'rental.confirm',
    entity: 'rental_requests',
    entityId: next.uuid,
    previous: { status: rental.status },
    next: { status: nextStatus },
  })

  return next
}

export async function approveAdminRental(event: H3Event, client: Client, profileId: number, identifier: string) {
  const rental = await loadAdminRental(client, identifier)
  const fullyCovered = rental.totalAmount === 0 && Boolean(rental.voucher)
  if (!canTransitionRentalStatus(rental.status, 'approved') && !fullyCovered) {
    throw new AppError('That rental cannot be approved yet.', 409, ERROR_CODES.CONFLICT)
  }

  if (rental.status !== 'paid' && !fullyCovered) {
    throw new AppError('Approve only after payment is confirmed.', 409, ERROR_CODES.CONFLICT)
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const row = await updateRentalStatus(client, rental.uuid, 'approved')
  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: 'approved',
    changedBy: profileId,
    note: 'Admin approved the rental.',
  })

  await insertNotification(client, {
    recipient_id: identity.customer_id,
    type: 'rental.approved',
    title: 'Rental approved',
    body: `Your rental ${rental.code} is approved and will be prepared for pickup.`,
    metadata: { rentalUuid: rental.uuid, rentalCode: rental.code },
  })

  const next = toPublicRental(row)
  await recordAudit(event, client, {
    action: 'rental.approve',
    entity: 'rental_requests',
    entityId: next.uuid,
    previous: { status: rental.status },
    next: { status: 'approved' },
  })

  return next
}

export async function deleteAdminRental(event: H3Event, client: Client, identifier: string) {
  const rental = await loadAdminRental(client, identifier)
  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const documents = await findIdentityByRentalId(client, identity.id)
  const paths = [documents?.government_id_path, documents?.selfie_path].filter((path): path is string => Boolean(path))
  if (paths.length) {
    await client.storage.from(STORAGE_BUCKETS.privateDocuments).remove(paths)
  }

  await deleteRentalByUuid(client, rental.uuid)

  await recordAudit(event, client, {
    action: 'rental.delete',
    entity: 'rental_requests',
    entityId: rental.uuid,
    previous: {
      uuid: rental.uuid,
      code: rental.code,
      status: rental.status,
    },
  })

  return {
    deleted: true,
    uuid: rental.uuid,
    code: rental.code,
  }
}
