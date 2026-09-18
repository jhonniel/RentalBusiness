import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const MAINTENANCE_SELECT = 'uuid, is_enabled, title, message'
const IMAGE_SELECT = 'uuid, storage_path, alt, sort_order'

export async function findSiteMaintenance(client: Client) {
  const { data, error } = await client
    .from('site_maintenance')
    .select(MAINTENANCE_SELECT)
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load maintenance settings.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function saveSiteMaintenance(client: Client, values: {
  isEnabled: boolean
  title: string
  message: string
}) {
  const existing = await findSiteMaintenance(client)
  const payload = {
    is_enabled: values.isEnabled,
    title: values.title,
    message: values.message,
  }

  const query = existing
    ? client.from('site_maintenance').update(payload).eq('id', 1)
    : client.from('site_maintenance').insert(payload)

  const { data, error } = await query.select(MAINTENANCE_SELECT).single()

  if (error || !data) {
    throw new AppError('We could not save maintenance settings.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function listMaintenanceImages(client: Client) {
  const { data, error } = await client
    .from('maintenance_images')
    .select(IMAGE_SELECT)
    .order('sort_order')
    .order('created_at')

  if (error) {
    throw new AppError('We could not load maintenance images.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function insertMaintenanceImage(client: Client, values: {
  storagePath: string
  alt: string
  sortOrder: number
}) {
  const { data, error } = await client
    .from('maintenance_images')
    .insert({
      storage_path: values.storagePath,
      alt: values.alt,
      sort_order: values.sortOrder,
    })
    .select(IMAGE_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not save that image.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function findMaintenanceImageByUuid(client: Client, uuid: string) {
  const { data, error } = await client
    .from('maintenance_images')
    .select(IMAGE_SELECT)
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that image.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function deleteMaintenanceImage(client: Client, uuid: string) {
  const { error } = await client
    .from('maintenance_images')
    .delete()
    .eq('uuid', uuid)

  if (error) {
    throw new AppError('We could not remove that image.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}
