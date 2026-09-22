import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { CreatePaymentInput, PaymentWebhookInput, SandboxCompleteInput } from '../../utils/payment-validation'
import { BUSINESS_CURRENCY } from '../../utils/constants'
import { canTransitionPaymentStatus, checkoutUrlFromMetadata, toPublicPayment } from '../../utils/payment'
import { canTransitionRentalStatus } from '../../utils/rental-status'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { getSupabaseAdminClient } from '../utils/supabase'
import { findRentalIdentity, findRentalIdentityById, insertRentalStatusHistory, updateRentalStatus } from '../repositories/rental.repository'
import {
  findOpenPaymentByRentalId,
  findPaidPaymentByRentalId,
  findPaymentByProviderTransaction,
  findPaymentByUuid,
  insertPayment,
  paymentMetadata,
  updatePaymentByUuid,
} from '../repositories/payment.repository'
import { logger } from '../utils/logger'
import { getOwnRental } from './rental.service'
import { getPaymentProvider } from './payments'
import { issueReceiptForPayment } from './receipt.service'

type Client = SupabaseClient<Database>

function adminClient() {
  return getSupabaseAdminClient()
}

async function issueReceiptSafely(
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
  try {
    await issueReceiptForPayment(event, payment)
  }
  catch {
    logger.warn('Receipt was not issued', { paymentUuid: payment.uuid })
  }
}

function siteOrigin() {
  const config = useRuntimeConfig()
  return String(config.public.siteUrl || process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

async function moveRentalStatus(
  event: H3Event,
  admin: Client,
  rental: { uuid: string, code: string, status: string },
  nextStatus: 'awaiting_payment' | 'paid',
  profileId: number | null,
  note: string,
) {
  if (rental.status === nextStatus) {
    return rental
  }

  if (!canTransitionRentalStatus(rental.status as import('../../utils/constants').RentalStatus, nextStatus)) {
    return rental
  }

  const identity = await findRentalIdentity(admin, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const row = await updateRentalStatus(admin, rental.uuid, nextStatus)
  await insertRentalStatusHistory(admin, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: nextStatus,
    changedBy: profileId ?? identity.customer_id,
    note,
  })

  await recordAudit(event, admin, {
    action: `rental.${nextStatus}`,
    entity: 'rental_requests',
    entityId: rental.uuid,
    previous: { status: rental.status },
    next: { status: nextStatus, code: rental.code },
  })

  return { uuid: row.uuid, code: row.code, status: row.status }
}

export async function applyPaymentEvent(
  event: H3Event,
  input: PaymentWebhookInput,
) {
  const admin = adminClient()
  const current = await findPaymentByProviderTransaction(admin, input.provider, input.providerTransactionId)

  if (!current) {
    throw new AppError('Payment not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  if (current.status === input.status) {
    if (input.status === 'paid') {
      await issueReceiptSafely(event, current)
    }
    return toPublicPayment(current)
  }

  if (!canTransitionPaymentStatus(current.status, input.status)) {
    throw new AppError('That payment status cannot be applied.', 409, ERROR_CODES.CONFLICT)
  }

  const paidAt = input.status === 'paid'
    ? (input.paidAt || new Date().toISOString())
    : current.paid_at

  const next = await updatePaymentByUuid(admin, current.uuid, {
    status: input.status,
    payment_method: input.paymentMethod ?? current.payment_method,
    paid_at: paidAt,
  })

  await recordAudit(event, admin, {
    action: 'payment.update',
    entity: 'payment_transactions',
    entityId: next.uuid,
    previous: { status: current.status },
    next: { status: next.status },
  })

  if (next.status === 'paid') {
    const rental = await findRentalIdentityById(admin, next.rental_id)
    if (rental) {
      await moveRentalStatus(
        event,
        admin,
        rental,
        'paid',
        null,
        'Payment confirmed by the provider.',
      )
    }
    await issueReceiptSafely(event, next)
  }

  return toPublicPayment(next)
}

export async function createPayment(
  event: H3Event,
  client: Client,
  profileId: number,
  input: CreatePaymentInput,
) {
  const rental = await getOwnRental(client, input.rentalUuid || input.rentalCode || '')

  if (!rental.waiver) {
    throw new AppError('Sign the waiver before paying.', 409, ERROR_CODES.CONFLICT)
  }

  if (!rental.identity) {
    throw new AppError('Upload a government ID and a selfie holding that ID before paying.', 409, ERROR_CODES.CONFLICT)
  }

  if (rental.status !== 'awaiting_payment') {
    throw new AppError('The shop must confirm this booking before payment.', 409, ERROR_CODES.CONFLICT)
  }

  if (rental.totalAmount <= 0) {
    throw new AppError('That rental has no amount due.', 409, ERROR_CODES.CONFLICT)
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const admin = adminClient()
  const paid = await findPaidPaymentByRentalId(admin, identity.id)
  if (paid) {
    throw new AppError('This rental is already paid.', 409, ERROR_CODES.CONFLICT)
  }

  const open = await findOpenPaymentByRentalId(admin, identity.id)
  const provider = getPaymentProvider()
  const returnUrl = `${siteOrigin()}/rentals/${rental.code}`

  if (open) {
    const existingUrl = checkoutUrlFromMetadata(open.metadata)
    if (open.provider_transaction_id && existingUrl) {
      return {
        payment: toPublicPayment(open),
        checkoutUrl: existingUrl,
        rental: { uuid: rental.uuid, code: rental.code, status: rental.status },
      }
    }

    const intent = await provider.createIntent({
      amount: Number(open.amount),
      currency: open.currency,
      rentalCode: rental.code,
      paymentUuid: open.uuid,
      returnUrl,
    })

    const updated = await updatePaymentByUuid(admin, open.uuid, {
      provider: intent.provider,
      provider_transaction_id: intent.providerTransactionId,
      status: 'processing',
      metadata: paymentMetadata(open.metadata, intent.checkoutUrl),
    })

    return {
      payment: toPublicPayment(updated),
      checkoutUrl: intent.checkoutUrl,
      rental: { uuid: rental.uuid, code: rental.code, status: rental.status },
    }
  }

  const created = await insertPayment(admin, {
    rental_id: identity.id,
    customer_id: profileId,
    amount: rental.totalAmount,
    currency: BUSINESS_CURRENCY,
    provider: provider.name,
    status: 'pending',
    metadata: {},
  })

  const intent = await provider.createIntent({
    amount: Number(created.amount),
    currency: created.currency,
    rentalCode: rental.code,
    paymentUuid: created.uuid,
    returnUrl,
  })

  const payment = await updatePaymentByUuid(admin, created.uuid, {
    provider: intent.provider,
    provider_transaction_id: intent.providerTransactionId,
    status: 'processing',
    metadata: paymentMetadata(created.metadata, intent.checkoutUrl),
  })

  const nextRental = await moveRentalStatus(
    event,
    admin,
    rental,
    'awaiting_payment',
    profileId,
    'Customer started checkout.',
  )

  await recordAudit(event, admin, {
    action: 'payment.create',
    entity: 'payment_transactions',
    entityId: payment.uuid,
    next: { rentalUuid: rental.uuid, amount: payment.amount, provider: payment.provider },
  })

  return {
    payment: toPublicPayment(payment),
    checkoutUrl: intent.checkoutUrl,
    rental: { uuid: nextRental.uuid, code: nextRental.code, status: nextRental.status },
  }
}

export async function getOwnPayment(client: Client, uuid: string) {
  const row = await findPaymentByUuid(client, uuid)
  if (!row) {
    throw new AppError('Payment not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  return toPublicPayment(row)
}

export async function verifyOwnPayment(event: H3Event, client: Client, uuid: string) {
  const row = await findPaymentByUuid(client, uuid)
  if (!row) {
    throw new AppError('Payment not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  if (!row.provider_transaction_id) {
    throw new AppError('That payment has not been sent to the provider.', 409, ERROR_CODES.CONFLICT)
  }

  const provider = getPaymentProvider()
  const remote = await provider.retrieve(row.provider_transaction_id)
  return applyPaymentEvent(event, {
    provider: remote.provider,
    providerTransactionId: remote.providerTransactionId,
    status: remote.status,
    paymentMethod: remote.paymentMethod ?? undefined,
    paidAt: remote.paidAt ?? undefined,
  })
}

export async function completeSandboxPayment(
  event: H3Event,
  client: Client,
  input: SandboxCompleteInput,
) {
  const provider = getPaymentProvider()
  if (provider.name !== 'sandbox') {
    throw new AppError('Sandbox checkout is not enabled.', 404, ERROR_CODES.NOT_FOUND)
  }

  const row = await findPaymentByUuid(client, input.paymentUuid)
  if (!row?.provider_transaction_id) {
    throw new AppError('Payment not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  return applyPaymentEvent(event, {
    provider: row.provider,
    providerTransactionId: row.provider_transaction_id,
    status: input.outcome,
    paymentMethod: 'sandbox',
    paidAt: input.outcome === 'paid' ? new Date().toISOString() : undefined,
  })
}
