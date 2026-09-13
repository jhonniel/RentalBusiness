import type {
  CatalogProduct,
  PublicCategory,
  PublicEquipmentAsset,
  PublicProduct,
  PublicProductImage,
} from '~/types/catalog'
import type { EquipmentStatus, ProductStatus } from './constants'
import { STORAGE_BUCKETS, publicStorageUrl } from './storage'

interface CategoryRow {
  uuid: string
  slug: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
}

interface ProductRow {
  id?: number
  uuid: string
  slug: string
  sku: string
  name: string
  description: string
  short_description: string
  daily_price: number
  weekly_price: number | null
  monthly_price: number | null
  deposit_amount: number
  late_fee: number
  replacement_value: number | null
  quantity: number
  reserved_quantity: number
  rented_quantity: number
  damaged_quantity: number
  maintenance_quantity: number
  lost_quantity: number
  available_quantity: number
  status: ProductStatus
  condition: string
  specifications: unknown
  included_accessories: unknown
  rental_rules: string | null
  model_path: string | null
  is_featured: boolean
  product_categories: CategoryRow | CategoryRow[] | null
}

interface ImageRow {
  uuid: string
  storage_path: string
  alt: string
  sort_order: number
  product_id?: number
}

interface AssetRow {
  uuid: string
  asset_code: string
  serial_number: string | null
  condition: string
  status: EquipmentStatus
  purchase_cost: number | null
  purchase_date: string | null
  replacement_value: number | null
  notes: string | null
  products: {
    uuid: string
    name: string
    sku: string
  } | {
    uuid: string
    name: string
    sku: string
  }[] | null
}

export function toPublicCategory(row: CategoryRow): PublicCategory {
  return {
    uuid: row.uuid,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }
}

export function publicImageUrl(supabaseUrl: string, storagePath: string): string {
  return publicStorageUrl(supabaseUrl, STORAGE_BUCKETS.productImages, storagePath)
}

export function toPublicImage(row: ImageRow, supabaseUrl: string): PublicProductImage {
  return {
    uuid: row.uuid,
    url: publicImageUrl(supabaseUrl, row.storage_path),
    alt: row.alt,
    sortOrder: row.sort_order,
    storagePath: row.storage_path,
  }
}

function asCategory(value: ProductRow['product_categories']): CategoryRow {
  const row = Array.isArray(value) ? value[0] : value
  if (!row) {
    throw new Error('Product is missing a category.')
  }
  return row
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
}

export function toPublicProduct(row: ProductRow, images: ImageRow[], supabaseUrl: string): PublicProduct {
  return {
    uuid: row.uuid,
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    description: row.description,
    shortDescription: row.short_description,
    category: toPublicCategory(asCategory(row.product_categories)),
    dailyPrice: Number(row.daily_price),
    weeklyPrice: row.weekly_price === null ? null : Number(row.weekly_price),
    monthlyPrice: row.monthly_price === null ? null : Number(row.monthly_price),
    depositAmount: Number(row.deposit_amount),
    lateFee: Number(row.late_fee),
    replacementValue: row.replacement_value === null ? null : Number(row.replacement_value),
    quantity: row.quantity,
    reservedQuantity: row.reserved_quantity,
    rentedQuantity: row.rented_quantity,
    damagedQuantity: row.damaged_quantity,
    maintenanceQuantity: row.maintenance_quantity,
    lostQuantity: row.lost_quantity,
    availableQuantity: row.available_quantity,
    status: row.status,
    condition: row.condition,
    specifications: asStringRecord(row.specifications),
    includedAccessories: asStringList(row.included_accessories),
    rentalRules: row.rental_rules,
    modelPath: row.model_path,
    isFeatured: row.is_featured,
    images: images.map(image => toPublicImage(image, supabaseUrl)),
  }
}

export function toCatalogProduct(row: ProductRow, images: ImageRow[], supabaseUrl: string): CatalogProduct {
  const product = toPublicProduct(row, images, supabaseUrl)
  return {
    uuid: product.uuid,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    description: product.description,
    shortDescription: product.shortDescription,
    category: product.category,
    dailyPrice: product.dailyPrice,
    weeklyPrice: product.weeklyPrice,
    monthlyPrice: product.monthlyPrice,
    depositAmount: product.depositAmount,
    lateFee: product.lateFee,
    replacementValue: product.replacementValue,
    availableQuantity: product.availableQuantity,
    condition: product.condition,
    specifications: product.specifications,
    includedAccessories: product.includedAccessories,
    rentalRules: product.rentalRules,
    isFeatured: product.isFeatured,
    images: product.images,
  }
}

export function toPublicAsset(row: AssetRow): PublicEquipmentAsset {
  const product = Array.isArray(row.products) ? row.products[0] : row.products
  if (!product) {
    throw new Error('Asset is missing a product.')
  }

  return {
    uuid: row.uuid,
    assetCode: row.asset_code,
    serialNumber: row.serial_number,
    condition: row.condition,
    status: row.status,
    purchaseCost: row.purchase_cost === null ? null : Number(row.purchase_cost),
    purchaseDate: row.purchase_date,
    replacementValue: row.replacement_value === null ? null : Number(row.replacement_value),
    notes: row.notes,
    product: {
      uuid: product.uuid,
      name: product.name,
      sku: product.sku,
    },
  }
}
