import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../types/database.types'
import type { ReceiptSnapshot } from '../../types/receipt'
import type { RentalReminderInput } from '../../utils/receipt-validation'
import { APP_NAME, BUSINESS_CURRENCY } from '../../utils/constants'
import { EMAIL_TEMPLATES } from '../../utils/email'
import { receiptIssuedEmail, rentalReminderEmail } from '../../utils/email-templates'
import { isReceiptNumber, toPublicReceipt } from '../../utils/receipt'
import { isRentalCode, toPublicRental } from '../../utils/rental'
import { isUuid } from '../../utils/slug'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { getSupabaseAdminClient } from '../utils/supabase'
import { findBusinessProfile } from '../repositories/business.repository'
import { findProfileById } from '../repositories/profile.repository'
import { findRentalByCode, findRentalByUuid, findRentalIdentity, findRentalIdentityById } from '../repositories/rental.repository'
import { findReceiptByNumber, findReceiptByPaymentId, findReceiptByUuid, insertReceipt } from '../repositories/receipt.repository'
import { sendTemplatedEmail } from './email.service'

type Client = SupabaseClient<Database>

function siteOrigin() {
  const config = useRuntimeConfig()
  return String(config.public.siteUrl || process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

async function customerEmail(admin: Client, userId: string) {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data.user?.email) {
    return null
  }
  return data.user.email
}

function buildSnapshot(input: {
  rental: ReturnType<typeof toPublicRental>
  payment: {
    uuid: string
    amount: number
    currency: string
    provider: string
    paid_at: string | null
  }
  customerName: string
  customerEmail: string | null
  business: { name: string, email: string | null, phone: string | null, address: string | null, currency: string }
}): ReceiptSnapshot {
  return {
    receiptNumber: '',
    issuedAt: new Date().toISOString(),
    currency: input.payment.currency || input.business.currency || BUSINESS_CURRENCY,
    rental: {
      uuid: input.rental.uuid,
      code: input.rental.code,
      startsOn: input.rental.startsOn,
      endsOn: input.rental.endsOn,
    },
    customer: {
      name: input.customerName,
      email: input.customerEmail,
    },
    business: {
      name: input.business.name || APP_NAME,
      email: input.business.email,
      phone: input.business.phone,
      address: input.business.address,
    },
    items: input.rental.items.map(item => ({
      name: item.product.name,
      sku: item.product.sku,
      quantity: item.quantity,
      dailyPrice: item.dailyPrice,
      lineTotal: item.lineTotal,
    })),
    amounts: {
      subtotal: input.rental.subtotal,
      depositAmount: input.rental.depositAmount,
      totalAmount: input.rental.totalAmount,
      paidAmount: Number(input.payment.amount),
    },
    payment: {
      uuid: input.payment.uuid,
      provider: input.payment.provider,
      paidAt: input.payment.paid_at,
    },
  }
}

export async function issueReceiptForPayment(
  event: H3Event,
  payment: {
    id: number
    uuid: string
    amount: number
    currency: string
    provider: string
    paid_at: string | null
    rental_id: number
    customer_id: number
    status: string
  },
) {
  if (payment.status !== 'paid') {
    return null
  }

  const admin = getSupabaseAdminClient()
  const existing = await findReceiptByPaymentId(admin, payment.id)
  if (existing) {
    return toPublicReceipt(existing)
  }

  const rentalIdentity = await findRentalIdentityById(admin, payment.rental_id)
  const rentalRow = rentalIdentity ? await findRentalByUuid(admin, rentalIdentity.uuid) : null
  const profile = await findProfileById(admin, payment.customer_id)
  if (!rentalRow || !profile) {
    throw new AppError('We could not issue that receipt.', 404, ERROR_CODES.NOT_FOUND)
  }

  const email = await customerEmail(admin, profile.user_id)
  const business = await findBusinessProfile(admin)
  const rental = toPublicRental(rentalRow)
  const snapshot = buildSnapshot({
    rental,
    payment,
    customerName: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Customer',
    customerEmail: email,
    business,
  })

  let row
  try {
    row = await insertReceipt(admin, {
      rental_id: payment.rental_id,
      payment_id: payment.id,
      snapshot: snapshot as unknown as Json,
    })
  }
  catch (error) {
    if (error instanceof AppError && error.code === ERROR_CODES.CONFLICT) {
      const raced = await findReceiptByPaymentId(admin, payment.id)
      return raced ? toPublicReceipt(raced) : null
    }
    throw error
  }

  const receipt = toPublicReceipt(row)
  await recordAudit(event, admin, {
    action: 'receipt.issue',
    entity: 'receipts',
    entityId: receipt.uuid,
    next: { receiptNumber: receipt.receiptNumber, rentalCode: rental.code },
  })

  if (email) {
    const message = receiptIssuedEmail(receipt.snapshot, `${siteOrigin()}/receipts/${receipt.receiptNumber}`)
    await sendTemplatedEmail(admin, {
      to: email,
      template: EMAIL_TEMPLATES.RECEIPT_ISSUED,
      entityKey: receipt.uuid,
      subject: message.subject,
      html: message.html,
    })
  }

  return receipt
}

export async function getOwnReceipt(client: Client, identifier: string) {
  const row = isUuid(identifier)
    ? await findReceiptByUuid(client, identifier)
    : isReceiptNumber(identifier)
      ? await findReceiptByNumber(client, identifier)
      : null

  if (!row) {
    throw new AppError('Receipt not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  return toPublicReceipt(row)
}

export async function sendRentalReminder(event: H3Event, input: RentalReminderInput) {
  const admin = getSupabaseAdminClient()
  const identifier = input.rentalUuid || input.rentalCode || ''
  const rentalRow = isUuid(identifier)
    ? await findRentalByUuid(admin, identifier)
    : isRentalCode(identifier)
      ? await findRentalByCode(admin, identifier)
      : null

  if (!rentalRow) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const rental = toPublicRental(rentalRow)
  const identity = await findRentalIdentity(admin, rental.uuid)
  const profile = identity ? await findProfileById(admin, identity.customer_id) : null
  if (!identity || !profile) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const email = await customerEmail(admin, profile.user_id)
  if (!email) {
    throw new AppError('That customer does not have an email address.', 409, ERROR_CODES.CONFLICT)
  }

  const customerName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Customer'
  const template = input.type === 'pickup'
    ? EMAIL_TEMPLATES.RENTAL_REMINDER_PICKUP
    : EMAIL_TEMPLATES.RENTAL_REMINDER_RETURN
  const message = rentalReminderEmail({
    type: input.type,
    customerName,
    rentalCode: rental.code,
    startsOn: rental.startsOn,
    endsOn: rental.endsOn,
    rentalUrl: `${siteOrigin()}/rentals/${rental.code}`,
  })

  const result = await sendTemplatedEmail(admin, {
    to: email,
    template,
    entityKey: `${rental.uuid}:${rental.startsOn}:${rental.endsOn}`,
    subject: message.subject,
    html: message.html,
  })

  await recordAudit(event, admin, {
    action: 'email.reminder',
    entity: 'rental_requests',
    entityId: rental.uuid,
    next: { type: input.type, status: result?.status ?? 'failed' },
  })

  return {
    rental: { uuid: rental.uuid, code: rental.code },
    type: input.type,
    status: result?.status ?? 'failed',
  }
}
