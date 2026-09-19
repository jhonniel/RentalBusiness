import type { EquipmentStatus, ProductStatus } from '~/utils/constants'

export interface PublicCategory {
  uuid: string
  slug: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
}

export interface PublicProductImage {
  uuid: string
  url: string
  alt: string
  sortOrder: number
  storagePath: string
}

export interface PublicProduct {
  uuid: string
  slug: string
  sku: string
  name: string
  description: string
  shortDescription: string
  category: PublicCategory
  dailyPrice: number
  weeklyPrice: number | null
  monthlyPrice: number | null
  depositAmount: number
  lateFee: number
  replacementValue: number | null
  quantity: number
  reservedQuantity: number
  rentedQuantity: number
  damagedQuantity: number
  maintenanceQuantity: number
  lostQuantity: number
  availableQuantity: number
  status: ProductStatus
  condition: string
  specifications: Record<string, string>
  includedAccessories: string[]
  rentalRules: string | null
  modelPath: string | null
  isFeatured: boolean
  images: PublicProductImage[]
}

export interface PublicEquipmentAsset {
  uuid: string
  assetCode: string
  serialNumber: string | null
  condition: string
  status: EquipmentStatus
  purchaseCost: number | null
  purchaseDate: string | null
  replacementValue: number | null
  notes: string | null
  product: {
    uuid: string
    name: string
    sku: string
  }
}

export interface ProductListResponse {
  items: PublicProduct[]
  page: number
  pageSize: number
  total: number
}

export interface InventoryListResponse {
  items: PublicEquipmentAsset[]
  page: number
  pageSize: number
  total: number
}

export interface CatalogProduct {
  uuid: string
  slug: string
  sku: string
  name: string
  description: string
  shortDescription: string
  category: PublicCategory
  dailyPrice: number
  weeklyPrice: number | null
  monthlyPrice: number | null
  depositAmount: number
  lateFee: number
  replacementValue: number | null
  availableQuantity: number
  condition: string
  specifications: Record<string, string>
  includedAccessories: string[]
  rentalRules: string | null
  isFeatured: boolean
  comingSoon: boolean
  images: PublicProductImage[]
}

export interface CatalogListResponse {
  items: CatalogProduct[]
  page: number
  pageSize: number
  total: number
}
