import type { PublicMaintenanceImage, PublicMaintenanceStatus } from '~/types/maintenance'
import { STORAGE_BUCKETS, publicStorageUrl } from './storage'

export const DEFAULT_MAINTENANCE_TITLE = 'We\'ll be right back'
export const DEFAULT_MAINTENANCE_MESSAGE = 'We\'re performing maintenance on the website. Please check back soon.'

export const MAINTENANCE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAINTENANCE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const MAINTENANCE_IMAGE_MAX_UPLOAD = 12

const PAGE_BYPASS_PREFIXES = [
  '/admin',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/confirm',
  '/accept-policies',
  '/maintenance',
]

const API_BYPASS_PREFIXES = [
  '/api/maintenance',
  '/api/admin',
  '/api/auth',
  '/api/health',
  '/api/cron',
  '/api/payments/webhook',
  '/api/terms',
  '/api/privacy',
]

export interface MaintenanceRow {
  uuid: string
  is_enabled: boolean
  title: string
  message: string
}

export interface MaintenanceImageRow {
  uuid: string
  storage_path: string
  alt: string
  sort_order: number
}

function matchesPrefix(path: string, prefixes: string[]) {
  const next = path.split('?')[0] || '/'
  return prefixes.some(prefix => next === prefix || next.startsWith(`${prefix}/`))
}

export function isMaintenanceBypassPath(path: string) {
  return matchesPrefix(path, PAGE_BYPASS_PREFIXES)
}

export function isMaintenanceBypassApiPath(path: string) {
  return matchesPrefix(path, API_BYPASS_PREFIXES)
}

export function isMaintenanceImageType(value: string | undefined): value is typeof MAINTENANCE_IMAGE_TYPES[number] {
  return Boolean(value && MAINTENANCE_IMAGE_TYPES.includes(value as typeof MAINTENANCE_IMAGE_TYPES[number]))
}

export function publicMaintenanceImageUrl(supabaseUrl: string, storagePath: string): string {
  return publicStorageUrl(supabaseUrl, STORAGE_BUCKETS.maintenanceImages, storagePath)
}

export function toPublicMaintenanceImage(row: MaintenanceImageRow, supabaseUrl: string): PublicMaintenanceImage {
  return {
    uuid: row.uuid,
    url: publicMaintenanceImageUrl(supabaseUrl, row.storage_path),
    alt: row.alt,
    sortOrder: row.sort_order,
  }
}

export function toPublicMaintenanceStatus(
  row: Partial<MaintenanceRow> | null | undefined,
  images: MaintenanceImageRow[] = [],
  supabaseUrl = '',
): PublicMaintenanceStatus {
  return {
    enabled: Boolean(row?.is_enabled),
    title: row?.title?.trim() || DEFAULT_MAINTENANCE_TITLE,
    message: row?.message?.trim() || DEFAULT_MAINTENANCE_MESSAGE,
    images: images.map(image => toPublicMaintenanceImage(image, supabaseUrl)),
  }
}
