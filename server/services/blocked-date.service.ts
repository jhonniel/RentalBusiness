import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../types/database.types'
import type { BlockedDateInput } from '../../utils/product-validation'
import { canBlockProductDates } from '../../utils/constants'
import { isPastBusinessDate } from '../../utils/datetime'
import { toPublicBlockedDate } from '../../utils/blocked-date'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { findProductByUuid } from '../repositories/product.repository'
import {
  deleteBlockedDateByUuid,
  findBlockedDateByUuid,
  insertBlockedDate,
  listBlockedDatesByProductId,
  listBlockedDatesOverlapping,
} from '../repositories/blocked-date.repository'

type Client = SupabaseClient<Database>

async function loadProduct(client: Client, productUuid: string) {
  const product = await findProductByUuid(client, productUuid)
  if (!product?.id) {
    throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  return product
}

function productFromJoin(value: unknown): { uuid: string, name: string, status?: string } | null {
  if (!value) {
    return null
  }

  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') {
    return null
  }

  const record = row as { uuid?: string, name?: string, status?: string }
  if (!record.uuid || !record.name) {
    return null
  }

  return { uuid: record.uuid, name: record.name, status: record.status }
}

export async function listAdminBlockedDates(client: Client, productUuid: string) {
  const product = await loadProduct(client, productUuid)
  const rows = await listBlockedDatesByProductId(client, product.id)
  return rows.map(row => toPublicBlockedDate(row, { uuid: product.uuid, name: product.name }))
}

export async function listAdminBlockedDatesOverlapping(client: Client, startsOn: string, endsOn: string) {
  try {
    const rows = await listBlockedDatesOverlapping(client, startsOn, endsOn)
    return rows.flatMap((row) => {
      const product = productFromJoin(row.products)
      if (!product || (product.status && !canBlockProductDates(product.status))) {
        return []
      }
      return [toPublicBlockedDate(row, product)]
    })
  }
  catch {
    return []
  }
}

export async function createAdminBlockedDate(
  event: H3Event,
  client: Client,
  productUuid: string,
  input: BlockedDateInput,
) {
  const product = await loadProduct(client, productUuid)
  if (isPastBusinessDate(input.startsOn)) {
    throw new AppError('Those dates are in the past.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  if (!canBlockProductDates(product.status)) {
    throw new AppError(
      product.status === 'coming_soon'
        ? 'A coming soon kit cannot have blocked dates.'
        : 'Only an active kit can have blocked dates.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  const row = await insertBlockedDate(client, {
    product_id: product.id,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    reason: input.reason || null,
  })

  await recordAudit(event, client, {
    action: 'blocked_date.create',
    entity: 'product_blocked_dates',
    entityId: row.uuid,
    next: {
      uuid: row.uuid,
      productUuid: product.uuid,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
    } as unknown as Json,
  })

  return toPublicBlockedDate(row, { uuid: product.uuid, name: product.name })
}

export async function deleteAdminBlockedDate(event: H3Event, client: Client, uuid: string) {
  const previous = await findBlockedDateByUuid(client, uuid)
  if (!previous) {
    throw new AppError('Blocked date not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  await deleteBlockedDateByUuid(client, uuid)

  await recordAudit(event, client, {
    action: 'blocked_date.delete',
    entity: 'product_blocked_dates',
    entityId: previous.uuid,
    previous: {
      uuid: previous.uuid,
      startsOn: previous.starts_on,
      endsOn: previous.ends_on,
    } as unknown as Json,
  })

  return { ok: true }
}
