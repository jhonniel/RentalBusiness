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
import { compressImageForStorage } from '../utils/image-compress'

type Client = SupabaseClient<Database>

const QR_BUCKET = 'payment-qr-images'

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

type MethodImage = 'qr' | 'logo'

const IMAGE_SETTINGS: Record<MethodImage, { label: string, maxEdge: number, quality: number, format: 'jpeg' | 'png', prefix: string }> = {
  qr: { label: 'QR image', maxEdge: 1600, quality: 88, format: 'jpeg', prefix: '' },
  logo: { label: 'logo', maxEdge: 512, quality: 90, format: 'png', prefix: 'logo-' },
}

function currentImagePath(row: NonNullable<Awaited<ReturnType<typeof findPaymentMethodByUuid>>>, kind: MethodImage) {
  return kind === 'qr' ? row.qr_storage_path : row.logo_storage_path ?? null
}

function keepMethodFields(row: NonNullable<Awaited<ReturnType<typeof findPaymentMethodByUuid>>>) {
  return {
    name: row.name,
    code: row.code,
    accountName: row.account_name,
    accountNumber: row.account_number,
    instructions: row.instructions,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }
}

async function uploadPaymentMethodImage(
  event: H3Event,
  client: Client,
  uuid: string,
  file: { filename?: string, type?: string, data: Buffer },
  kind: MethodImage,
) {
  const current = await findPaymentMethodByUuid(client, uuid)
  if (!current) {
    throw new AppError('Payment method not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const settings = IMAGE_SETTINGS[kind]
  const image = await compressImageForStorage(file, settings)
  const storagePath = `${uuid}/${settings.prefix}${crypto.randomUUID()}.${image.extension}`
  const { error } = await client.storage.from(QR_BUCKET).upload(storagePath, image.data, {
    contentType: image.type,
    upsert: false,
  })

  if (error) {
    throw new AppError(`We could not upload that ${settings.label}.`, 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  let row
  try {
    row = await updatePaymentMethod(client, uuid, {
      ...keepMethodFields(current),
      ...(kind === 'qr' ? { qrStoragePath: storagePath } : { logoStoragePath: storagePath }),
    })
  }
  catch (caught) {
    await client.storage.from(QR_BUCKET).remove([storagePath])
    throw caught
  }

  const previousPath = currentImagePath(current, kind)
  if (previousPath) {
    await client.storage.from(QR_BUCKET).remove([previousPath])
  }

  await recordAudit(event, client, {
    action: `payment_method.${kind}.upload`,
    entity: 'payment_methods',
    entityId: uuid,
    previous: { storagePath: previousPath },
    next: { storagePath },
  })

  return toPublicPaymentMethod(row, supabaseUrl())
}

async function removePaymentMethodImage(event: H3Event, client: Client, uuid: string, kind: MethodImage) {
  const current = await findPaymentMethodByUuid(client, uuid)
  if (!current) {
    throw new AppError('Payment method not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const previousPath = currentImagePath(current, kind)
  const row = await updatePaymentMethod(client, uuid, {
    ...keepMethodFields(current),
    ...(kind === 'qr' ? { qrStoragePath: null } : { logoStoragePath: null }),
  })

  if (previousPath) {
    await client.storage.from(QR_BUCKET).remove([previousPath])
  }

  await recordAudit(event, client, {
    action: `payment_method.${kind}.delete`,
    entity: 'payment_methods',
    entityId: uuid,
    previous: { storagePath: previousPath },
  })

  return asPublic(row)
}

export function uploadPaymentMethodQr(event: H3Event, client: Client, uuid: string, file: { filename?: string, type?: string, data: Buffer }) {
  return uploadPaymentMethodImage(event, client, uuid, file, 'qr')
}

export function removePaymentMethodQr(event: H3Event, client: Client, uuid: string) {
  return removePaymentMethodImage(event, client, uuid, 'qr')
}

export function uploadPaymentMethodLogo(event: H3Event, client: Client, uuid: string, file: { filename?: string, type?: string, data: Buffer }) {
  return uploadPaymentMethodImage(event, client, uuid, file, 'logo')
}

export function removePaymentMethodLogo(event: H3Event, client: Client, uuid: string) {
  return removePaymentMethodImage(event, client, uuid, 'logo')
}
