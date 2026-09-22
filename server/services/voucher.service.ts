import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../types/database.types'
import type { VoucherInput } from '../../utils/voucher-validation'
import type { VoucherStatus } from '../../utils/constants'
import { calendarDateInZone } from '../../utils/datetime'
import { fromMinorUnits, toMinorUnits } from '../../utils/currency'
import {
  normalizeVoucherCode,
  quoteVoucherDiscount,
  toPublicVoucher,
  voucherIsRedeemable,
} from '../../utils/voucher'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { getSupabaseAdminClient } from '../utils/supabase'
import { findRentalByUuid, findRentalIdentity, updateRentalDiscount } from '../repositories/rental.repository'
import {
  decrementVoucherRedemption,
  deleteRedemptionByRentalId,
  findRedemptionByRentalId,
  findVoucherByCode,
  findVoucherByUuid,
  incrementVoucherRedemption,
  insertRedemption,
  insertVoucher,
  listVouchers,
  updateVoucherByUuid,
} from '../repositories/voucher.repository'
import { findOpenPaymentByRentalId, updatePaymentByUuid } from '../repositories/payment.repository'
import { getOwnRental } from './rental.service'
import { toPublicRental } from '../../utils/rental'

type Client = SupabaseClient<Database>

function sanitizeSearch(value?: string) {
  return value?.replace(/[%_,]/g, '').trim() || undefined
}

export async function listAdminVouchers(client: Client, query: {
  search?: string
  status?: VoucherStatus
  page: number
  pageSize: number
}) {
  const from = (query.page - 1) * query.pageSize
  const { rows, total } = await listVouchers(client, {
    search: sanitizeSearch(query.search),
    status: query.status,
    from,
    to: from + query.pageSize - 1,
  })

  return {
    items: rows.map(toPublicVoucher),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function saveAdminVoucher(event: H3Event, client: Client, input: VoucherInput, uuid?: string) {
  const payload = {
    name: input.name,
    code: input.code,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    max_redemptions: input.maxRedemptions,
    min_subtotal: input.minSubtotal,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    status: input.status,
  }

  const previous = uuid ? await findVoucherByUuid(client, uuid) : null
  if (uuid && !previous) {
    throw new AppError('Voucher not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const row = uuid
    ? await updateVoucherByUuid(client, uuid, payload)
    : await insertVoucher(client, payload)

  await recordAudit(event, client, {
    action: uuid ? 'voucher.update' : 'voucher.create',
    entity: 'vouchers',
    entityId: row.uuid,
    previous: previous ? { uuid: previous.uuid, code: previous.code, status: previous.status } : null,
    next: { uuid: row.uuid, code: row.code, status: row.status } as unknown as Json,
  })

  return toPublicVoucher(row)
}

async function syncOpenPaymentAmount(admin: Client, rentalId: number, amount: number) {
  const open = await findOpenPaymentByRentalId(admin, rentalId)
  if (!open || ['paid', 'refunded'].includes(open.status)) {
    return
  }

  await updatePaymentByUuid(admin, open.uuid, { amount })
}

export async function applyOwnRentalVoucher(
  event: H3Event,
  client: Client,
  identifier: string,
  rawCode: string,
) {
  const rental = await getOwnRental(client, identifier)
  if (!['draft', 'pending', 'awaiting_payment'].includes(rental.status)) {
    throw new AppError('That rental can no longer accept a voucher.', 409, ERROR_CODES.CONFLICT)
  }

  if (['paid', 'approved', 'completed'].includes(rental.status)) {
    throw new AppError('A paid rental cannot accept a voucher.', 409, ERROR_CODES.CONFLICT)
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const admin = getSupabaseAdminClient()
  const code = normalizeVoucherCode(rawCode)
  const voucher = await findVoucherByCode(admin, code)
  if (!voucher) {
    throw new AppError('That voucher code is not valid.', 404, ERROR_CODES.NOT_FOUND)
  }

  const reason = voucherIsRedeemable(voucher, rental.subtotal, calendarDateInZone())
  if (reason) {
    throw new AppError(reason, 409, ERROR_CODES.CONFLICT)
  }

  const existing = await findRedemptionByRentalId(admin, identity.id)
  if (existing?.code === code) {
    const current = await findRentalByUuid(admin, rental.uuid)
    return current ? toPublicRental(current) : rental
  }

  const discountAmount = quoteVoucherDiscount({
    type: voucher.discount_type,
    value: Number(voucher.discount_value),
    subtotal: rental.subtotal,
  })
  const totalAmount = fromMinorUnits(toMinorUnits(Math.max(0, rental.subtotal - discountAmount)))

  if (existing) {
    await deleteRedemptionByRentalId(admin, identity.id)
    await decrementVoucherRedemption(admin, existing.voucher_id)
  }

  await incrementVoucherRedemption(admin, voucher.id, voucher.max_redemptions)
  await insertRedemption(admin, {
    voucher_id: voucher.id,
    rental_id: identity.id,
    customer_id: identity.customer_id,
    code: voucher.code,
    name: voucher.name,
    discount_amount: discountAmount,
  })

  const row = await updateRentalDiscount(admin, rental.uuid, {
    discountAmount,
    totalAmount,
  })
  await syncOpenPaymentAmount(admin, identity.id, totalAmount)

  await recordAudit(event, admin, {
    action: 'rental.voucher.apply',
    entity: 'rental_requests',
    entityId: rental.uuid,
    previous: { discountAmount: rental.discountAmount, totalAmount: rental.totalAmount },
    next: { code: voucher.code, discountAmount, totalAmount },
  })

  return toPublicRental(row)
}

export async function removeOwnRentalVoucher(event: H3Event, client: Client, identifier: string) {
  const rental = await getOwnRental(client, identifier)
  if (!['draft', 'pending', 'awaiting_payment'].includes(rental.status)) {
    throw new AppError('That rental can no longer change a voucher.', 409, ERROR_CODES.CONFLICT)
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const admin = getSupabaseAdminClient()
  const existing = await findRedemptionByRentalId(admin, identity.id)
  if (!existing) {
    return rental
  }

  await deleteRedemptionByRentalId(admin, identity.id)
  await decrementVoucherRedemption(admin, existing.voucher_id)

  const row = await updateRentalDiscount(admin, rental.uuid, {
    discountAmount: 0,
    totalAmount: rental.subtotal,
  })
  await syncOpenPaymentAmount(admin, identity.id, rental.subtotal)

  await recordAudit(event, admin, {
    action: 'rental.voucher.remove',
    entity: 'rental_requests',
    entityId: rental.uuid,
    previous: { code: existing.code, discountAmount: rental.discountAmount },
    next: { discountAmount: 0, totalAmount: rental.subtotal },
  })

  return toPublicRental(row)
}
