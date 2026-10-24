import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { PublicRental } from '../../types/rental'
import type { MarkAdminPaidInput } from '../../utils/payment-validation'
import type { AdminLateFeeTypeInput, VoidAdminLateFeeInput } from '../../utils/rental-validation'
import { BUSINESS_CURRENCY } from '../../utils/constants'
import {
  LATE_FEE_TYPE_LABELS,
  buildLateFee,
  canChangeLateFee,
  canPayLateFee,
  canVoidLateFee,
} from '../../utils/late-fee'
import { isRentalCode, toShopRental } from '../../utils/rental'
import { isUuid } from '../../utils/slug'
import { recordAudit } from '../utils/audit'
import { AppError, ERROR_CODES } from '../utils/errors'
import { findLateFeeByRentalId, saveLateFee } from '../repositories/late-fee.repository'
import { insertPayment } from '../repositories/payment.repository'
import { findRentalByCode, findRentalByUuid, insertRentalStatusHistory } from '../repositories/rental.repository'
import { issueReceiptForPayment } from './receipt.service'

type Client = SupabaseClient<Database>
type LateFeeRental = Pick<PublicRental, 'status' | 'returnAt' | 'items'>

export async function rentalLateFee(client: Client, rental: LateFeeRental, rentalId: number) {
  const { row, available } = await findLateFeeByRentalId(client, rentalId).catch(() => ({ row: null, available: false }))
  return buildLateFee(rental, row, available)
}

export async function stopLateFeeClock(client: Client, rental: LateFeeRental, rentalId: number, profileId: number | null) {
  const { row, available } = await findLateFeeByRentalId(client, rentalId).catch(() => ({ row: null, available: false }))
  if (!available || row?.stopped_at || row?.paid_at) {
    return
  }
  const current = buildLateFee(rental, row, available)
  if (!row && current.amount <= 0) {
    return
  }
  await saveLateFee(client, rentalId, { stopped_at: new Date().toISOString(), updated_by: profileId })
}

async function loadLateFeeRental(client: Client, identifier: string) {
  const row = isUuid(identifier)
    ? await findRentalByUuid(client, identifier)
    : isRentalCode(identifier)
      ? await findRentalByCode(client, identifier)
      : null
  if (!row) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const rental = toShopRental(row)
  const { row: feeRow, available } = await findLateFeeByRentalId(client, row.id)
  if (!available) {
    throw new AppError('Paste the rental late fees SQL in Supabase to turn on late fees.', 409, ERROR_CODES.CONFLICT)
  }
  return { id: row.id, customerId: row.customer_id, rental, feeRow, fee: buildLateFee(rental, feeRow, available) }
}

function money(value: number) {
  return `${value.toFixed(2)} ${BUSINESS_CURRENCY}`
}

export async function setAdminLateFeeType(event: H3Event, client: Client, profileId: number, identifier: string, input: AdminLateFeeTypeInput) {
  const loaded = await loadLateFeeRental(client, identifier)
  if (!canChangeLateFee(loaded.fee.status)) {
    throw new AppError('A paid late fee cannot be changed.', 409, ERROR_CODES.CONFLICT)
  }

  const saved = await saveLateFee(client, loaded.id, {
    fee_type: input.type,
    custom_amount: input.type === 'custom' ? input.customAmount ?? 0 : null,
    updated_by: profileId,
  })
  const next = buildLateFee(loaded.rental, saved, true)
  await recordAudit(event, client, {
    action: 'rental.late_fee.type',
    entity: 'rental_requests',
    entityId: loaded.rental.uuid,
    previous: { type: loaded.fee.type, amount: loaded.fee.amount },
    next: { rentalCode: loaded.rental.code, type: next.type, customAmount: next.customAmount, amount: next.amount },
  })
  return next
}

export async function voidAdminLateFee(event: H3Event, client: Client, profileId: number, identifier: string, input: VoidAdminLateFeeInput) {
  const loaded = await loadLateFeeRental(client, identifier)
  if (!canVoidLateFee(loaded.fee.status)) {
    throw new AppError('There is no late fee to void.', 409, ERROR_CODES.CONFLICT)
  }

  const saved = await saveLateFee(client, loaded.id, {
    voided_at: new Date().toISOString(),
    voided_by: profileId,
    void_reason: input.reason || null,
    updated_by: profileId,
  })
  await insertRentalStatusHistory(client, {
    rentalId: loaded.id,
    fromStatus: loaded.rental.status,
    toStatus: loaded.rental.status,
    changedBy: profileId,
    note: `Admin voided the late fee of ${money(loaded.fee.amount)}.${input.reason ? ` Reason: ${input.reason}` : ''}`,
  })
  await recordAudit(event, client, {
    action: 'rental.late_fee.void',
    entity: 'rental_requests',
    entityId: loaded.rental.uuid,
    previous: { amount: loaded.fee.amount, status: loaded.fee.status },
    next: { rentalCode: loaded.rental.code, status: 'void', reason: input.reason || null },
  })
  return buildLateFee(loaded.rental, saved, true)
}

export async function restoreAdminLateFee(event: H3Event, client: Client, profileId: number, identifier: string) {
  const loaded = await loadLateFeeRental(client, identifier)
  if (loaded.fee.status !== 'void') {
    throw new AppError('Only a voided late fee can be restored.', 409, ERROR_CODES.CONFLICT)
  }

  const saved = await saveLateFee(client, loaded.id, {
    voided_at: null,
    voided_by: null,
    void_reason: null,
    updated_by: profileId,
  })
  const next = buildLateFee(loaded.rental, saved, true)
  await recordAudit(event, client, {
    action: 'rental.late_fee.restore',
    entity: 'rental_requests',
    entityId: loaded.rental.uuid,
    previous: { status: 'void' },
    next: { rentalCode: loaded.rental.code, status: next.status, amount: next.amount },
  })
  return next
}

export async function markAdminLateFeePaid(event: H3Event, client: Client, profileId: number, identifier: string, input: MarkAdminPaidInput) {
  const loaded = await loadLateFeeRental(client, identifier)
  if (!canPayLateFee(loaded.fee.status) || loaded.fee.amount <= 0) {
    throw new AppError('There is no late fee to pay.', 409, ERROR_CODES.CONFLICT)
  }

  const amount = loaded.fee.amount
  const paidAt = new Date().toISOString()
  const reference = loaded.feeRow?.uuid ?? loaded.rental.uuid
  const payment = await insertPayment(client, {
    rental_id: loaded.id,
    customer_id: loaded.customerId,
    amount,
    currency: BUSINESS_CURRENCY,
    provider: 'shop',
    provider_transaction_id: `shop-late-fee-${reference}`,
    status: 'paid',
    payment_method: input.paymentMethod,
    paid_at: paidAt,
    metadata: {
      kind: 'late_fee',
      recordedBy: 'admin',
      lateFeeType: loaded.fee.type,
      hoursLate: loaded.fee.hoursLate,
      includesDeposit: false,
    },
  })

  const saved = await saveLateFee(client, loaded.id, {
    paid_amount: amount,
    paid_at: paidAt,
    payment_id: payment.id,
    stopped_at: loaded.feeRow?.stopped_at ?? paidAt,
    updated_by: profileId,
  })
  await insertRentalStatusHistory(client, {
    rentalId: loaded.id,
    fromStatus: loaded.rental.status,
    toStatus: loaded.rental.status,
    changedBy: profileId,
    note: `Admin recorded a ${input.paymentMethod} payment of ${money(amount)} for the late fee (${LATE_FEE_TYPE_LABELS[loaded.fee.type].toLowerCase()}).`,
  })

  try {
    await issueReceiptForPayment(event, payment)
  }
  catch {
    // Receipt email can fail without rolling back the sale.
  }

  await recordAudit(event, client, {
    action: 'rental.late_fee.paid',
    entity: 'payment_transactions',
    entityId: payment.uuid,
    next: { rentalCode: loaded.rental.code, amount, type: loaded.fee.type, paymentMethod: input.paymentMethod },
  })
  return buildLateFee(loaded.rental, saved, true)
}
