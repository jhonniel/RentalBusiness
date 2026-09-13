import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../types/database.types'
import type { PaymentMethodInput } from '../../utils/payment-method-validation'
import { toPublicPaymentMethod } from '../../utils/payment-method'
import { slugify } from '../../utils/slug'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import {
  createPaymentMethod,
  findPaymentMethodByUuid,
  listPaymentMethods,
  updatePaymentMethod,
} from '../repositories/payment-method.repository'

type Client = SupabaseClient<Database>

const QR_BUCKET = 'payment-qr-images'
const QR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function supabaseUrl() {
  const config = useRuntimeConfig()
  return config.public.supabaseUrl || process.env.NUXT_PUBLIC_SUPABASE_URL || ''
}

function uniqueCode(base: string, existing: string[]) {
  const root = slugify(base) || 'payment'
  if (!existing.includes(root)) {
    return root
  }

  let index = 2
  while (existing.includes(`${root}-${index}`)) {
    index += 1
  }
  return `${root}-${index}`
}

function blankToNull(value?: string) {
  const trimmed = value?.trim() ?? ''
  return trimmed.length ? trimmed : null
}

function asPublic(row: Awaited<ReturnType<typeof findPaymentMethodByUuid>>) {
  if (!row) {
    throw new AppError('Payment method not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  return toPublicPaymentMethod(row, supabaseUrl())
}

export async function getAdminPaymentMethods(client: Client) {
  const rows = await listPaymentMethods(client)
  return rows.map(row => toPublicPaymentMethod(row, supabaseUrl()))
}

export async function getActivePaymentMethods(client: Client) {
  const rows = await listPaymentMethods(client, true)
  return rows.map(row => toPublicPaymentMethod(row, supabaseUrl()))
}

export async function savePaymentMethod(event: H3Event, client: Client, input: PaymentMethodInput, uuid?: string) {
  const rows = await listPaymentMethods(client)
  const code = uniqueCode(input.code || input.name, rows.filter(row => row.uuid !== uuid).map(row => row.code))
  const payload = {
    name: input.name,
    code,
    accountName: blankToNull(input.accountName),
    accountNumber: blankToNull(input.accountNumber),
    instructions: blankToNull(input.instructions),
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  }

  const row = uuid
    ? await updatePaymentMethod(client, uuid, payload)
    : await createPaymentMethod(client, payload)

  await recordAudit(event, client, {
    action: uuid ? 'payment_method.update' : 'payment_method.create',
    entity: 'payment_methods',
    entityId: row.uuid,
    next: toPublicPaymentMethod(row, supabaseUrl()) as unknown as Json,
  })

  return toPublicPaymentMethod(row, supabaseUrl())
}

export async function uploadPaymentMethodQr(
  event: H3Event,
  client: Client,
  uuid: string,
  file: { filename?: string, type?: string, data: Buffer },
) {
  const current = await findPaymentMethodByUuid(client, uuid)
  if (!current) {
    throw new AppError('Payment method not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  if (!file.type || !QR_TYPES.includes(file.type)) {
    throw new AppError('Upload a JPG, PNG, or WebP QR image.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  if (file.data.byteLength > 5 * 1024 * 1024) {
    throw new AppError('QR images must be 5 MB or smaller.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const storagePath = `${uuid}/${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from(QR_BUCKET).upload(storagePath, file.data, {
    contentType: file.type,
    upsert: false,
  })

  if (error) {
    throw new AppError('We could not upload that QR image.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  if (current.qr_storage_path) {
    await client.storage.from(QR_BUCKET).remove([current.qr_storage_path])
  }

  const row = await updatePaymentMethod(client, uuid, {
    name: current.name,
    code: current.code,
    accountName: current.account_name,
    accountNumber: current.account_number,
    instructions: current.instructions,
    qrStoragePath: storagePath,
    sortOrder: current.sort_order,
    isActive: current.is_active,
  })

  await recordAudit(event, client, {
    action: 'payment_method.qr.upload',
    entity: 'payment_methods',
    entityId: uuid,
    previous: { storagePath: current.qr_storage_path },
    next: { storagePath },
  })

  return toPublicPaymentMethod(row, supabaseUrl())
}

export async function removePaymentMethodQr(event: H3Event, client: Client, uuid: string) {
  const current = await findPaymentMethodByUuid(client, uuid)
  if (!current) {
    throw new AppError('Payment method not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  if (current.qr_storage_path) {
    await client.storage.from(QR_BUCKET).remove([current.qr_storage_path])
  }

  const row = await updatePaymentMethod(client, uuid, {
    name: current.name,
    code: current.code,
    accountName: current.account_name,
    accountNumber: current.account_number,
    instructions: current.instructions,
    qrStoragePath: null,
    sortOrder: current.sort_order,
    isActive: current.is_active,
  })

  await recordAudit(event, client, {
    action: 'payment_method.qr.delete',
    entity: 'payment_methods',
    entityId: uuid,
    previous: { storagePath: current.qr_storage_path },
  })

  return asPublic(row)
}
