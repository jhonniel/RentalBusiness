import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { PublicMaintenanceImage, PublicMaintenanceProduct, PublicMaintenanceStatus } from '../../types/maintenance'
import type { MaintenanceInput } from '../../utils/maintenance-validation'
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  DEFAULT_MAINTENANCE_TITLE,
  MAINTENANCE_IMAGE_MAX_BYTES,
  MAINTENANCE_IMAGE_MAX_UPLOAD,
  fallbackMaintenanceProducts,
  isMaintenanceImageType,
  maintenanceProductsFromCatalog,
  toPublicMaintenanceImage,
  toPublicMaintenanceStatus,
} from '../../utils/maintenance'
import { STORAGE_BUCKETS } from '../../utils/storage'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { getSupabaseAdminClient, isSupabaseConfigured } from '../utils/supabase'
import { getPublicProducts } from './catalog.service'
import {
  deleteMaintenanceImage,
  findMaintenanceImageByUuid,
  findSiteMaintenance,
  insertMaintenanceImage,
  listMaintenanceImages,
  saveSiteMaintenance,
} from '../repositories/maintenance.repository'

type Client = SupabaseClient<Database>

const IMAGE_BUCKET = STORAGE_BUCKETS.maintenanceImages

let enabledCache: { value: boolean, expiresAt: number } | null = null

function supabaseUrl() {
  const config = useRuntimeConfig()
  return config.public.supabaseUrl || process.env.NUXT_PUBLIC_SUPABASE_URL || ''
}

function emptyStatus(): PublicMaintenanceStatus {
  return toPublicMaintenanceStatus({
    uuid: '',
    is_enabled: false,
    title: DEFAULT_MAINTENANCE_TITLE,
    message: DEFAULT_MAINTENANCE_MESSAGE,
  })
}

export function clearMaintenanceCache() {
  enabledCache = null
}

async function listMaintenanceProducts(client: Client): Promise<PublicMaintenanceProduct[]> {
  try {
    const catalog = await getPublicProducts(client, {
      page: 1,
      pageSize: 24,
    })
    return maintenanceProductsFromCatalog(catalog.items)
  }
  catch {
    return fallbackMaintenanceProducts()
  }
}

export async function getPublicMaintenance(client: Client): Promise<PublicMaintenanceStatus> {
  const [row, images, products] = await Promise.all([
    findSiteMaintenance(client),
    listMaintenanceImages(client),
    listMaintenanceProducts(client),
  ])
  return toPublicMaintenanceStatus(row, images, supabaseUrl(), products)
}

export async function getPublicMaintenanceSafe(client?: Client | null): Promise<PublicMaintenanceStatus> {
  if (!isSupabaseConfigured()) {
    return emptyStatus()
  }

  try {
    return await getPublicMaintenance(client ?? getSupabaseAdminClient())
  }
  catch {
    return emptyStatus()
  }
}

export async function isSiteInMaintenance(): Promise<boolean> {
  if (enabledCache && enabledCache.expiresAt > Date.now()) {
    return enabledCache.value
  }

  const status = await getPublicMaintenanceSafe()
  enabledCache = {
    value: status.enabled,
    expiresAt: Date.now() + 5_000,
  }
  return status.enabled
}

export async function getAdminMaintenance(client: Client): Promise<PublicMaintenanceStatus> {
  return getPublicMaintenance(client)
}

export async function updateAdminMaintenance(
  event: H3Event,
  client: Client,
  input: MaintenanceInput,
): Promise<PublicMaintenanceStatus> {
  const previous = await getPublicMaintenance(client)
  const row = await saveSiteMaintenance(client, {
    isEnabled: input.enabled,
    title: input.title,
    message: input.message,
  })
  clearMaintenanceCache()
  const next = await getPublicMaintenance(client)

  await recordAudit(event, client, {
    action: 'maintenance.update',
    entity: 'site_maintenance',
    entityId: row.uuid,
    previous: {
      enabled: previous.enabled,
      title: previous.title,
      message: previous.message,
    },
    next: {
      enabled: next.enabled,
      title: next.title,
      message: next.message,
    },
  })

  return next
}

export async function addMaintenanceImages(
  event: H3Event,
  client: Client,
  files: { filename?: string, type?: string, data: Buffer }[],
  alt: string,
): Promise<PublicMaintenanceImage[]> {
  if (!files.length) {
    throw new AppError('Choose one or more images to upload.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  if (files.length > MAINTENANCE_IMAGE_MAX_UPLOAD) {
    throw new AppError('Upload up to 12 images at a time.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  const existing = await listMaintenanceImages(client)
  const uploaded: PublicMaintenanceImage[] = []

  for (const [index, file] of files.entries()) {
    uploaded.push(await addMaintenanceImage(event, client, file, alt, existing.length + index))
  }

  return uploaded
}

async function addMaintenanceImage(
  event: H3Event,
  client: Client,
  file: { filename?: string, type?: string, data: Buffer },
  alt: string,
  sortOrder: number,
): Promise<PublicMaintenanceImage> {
  if (!isMaintenanceImageType(file.type)) {
    throw new AppError('Upload a JPG, PNG, or WebP image.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  if (file.data.byteLength > MAINTENANCE_IMAGE_MAX_BYTES) {
    throw new AppError('Images must be 5 MB or smaller.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const storagePath = `${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from(IMAGE_BUCKET).upload(storagePath, file.data, {
    contentType: file.type,
    upsert: false,
  })

  if (error) {
    throw new AppError('We could not upload that image.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  const row = await insertMaintenanceImage(client, {
    storagePath,
    alt,
    sortOrder,
  })

  await recordAudit(event, client, {
    action: 'maintenance.image.create',
    entity: 'maintenance_images',
    entityId: row.uuid,
    next: { storagePath },
  })

  return toPublicMaintenanceImage(row, supabaseUrl())
}

export async function removeMaintenanceImage(event: H3Event, client: Client, imageUuid: string) {
  const image = await findMaintenanceImageByUuid(client, imageUuid)
  if (!image) {
    throw new AppError('Image not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  await client.storage.from(IMAGE_BUCKET).remove([image.storage_path])
  await deleteMaintenanceImage(client, imageUuid)

  await recordAudit(event, client, {
    action: 'maintenance.image.delete',
    entity: 'maintenance_images',
    entityId: imageUuid,
    previous: { storagePath: image.storage_path },
  })

  return { ok: true }
}
