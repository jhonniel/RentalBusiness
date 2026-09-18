import type { PublicMaintenanceImage, PublicMaintenanceProduct, PublicMaintenanceStatus } from '~/types/maintenance'
import { STORAGE_BUCKETS, publicStorageUrl } from './storage'
import { STOREFRONT_KIT_PRODUCTS } from './storefront'

export const DEFAULT_MAINTENANCE_TITLE = 'We\'ll be right back'
export const DEFAULT_MAINTENANCE_MESSAGE = 'We\'re performing maintenance on the website. Please check back soon.'

export const MAINTENANCE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAINTENANCE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const MAINTENANCE_IMAGE_MAX_UPLOAD = 12
export const MAINTENANCE_PRODUCT_LIMIT = 3

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
  '/api/cookie-policy',
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

export function toPublicMaintenanceProduct(product: {
  slug: string
  name: string
  category: { slug: string }
  images: { url: string }[]
}): PublicMaintenanceProduct {
  return {
    slug: product.slug,
    name: product.name,
    categorySlug: product.category.slug,
    imageUrl: product.images[0]?.url ?? null,
  }
}

export function fallbackMaintenanceProducts(): PublicMaintenanceProduct[] {
  return STOREFRONT_KIT_PRODUCTS.map(product => ({
    slug: product.slug,
    name: product.name,
    categorySlug: product.categorySlug,
    imageUrl: null,
  }))
}

export function maintenanceProductsFromCatalog(catalog: Array<{
  slug: string
  name: string
  category: { slug: string }
  images: { url: string }[]
}>): PublicMaintenanceProduct[] {
  const bySlug = new Map(catalog.map(product => [product.slug, toPublicMaintenanceProduct(product)]))
  return fallbackMaintenanceProducts().map(product => bySlug.get(product.slug) ?? product)
}

export function toPublicMaintenanceStatus(
  row: Partial<MaintenanceRow> | null | undefined,
  images: MaintenanceImageRow[] = [],
  supabaseUrl = '',
  products: PublicMaintenanceProduct[] = fallbackMaintenanceProducts(),
): PublicMaintenanceStatus {
  return {
    enabled: Boolean(row?.is_enabled),
    title: row?.title?.trim() || DEFAULT_MAINTENANCE_TITLE,
    message: row?.message?.trim() || DEFAULT_MAINTENANCE_MESSAGE,
    images: images.map(image => toPublicMaintenanceImage(image, supabaseUrl)),
    products: products.slice(0, MAINTENANCE_PRODUCT_LIMIT),
  }
}
