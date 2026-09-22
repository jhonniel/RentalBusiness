import { describe, expect, it } from 'vitest'
import { canDeleteProduct, toCatalogProduct, toPublicAsset, toPublicCategory, toPublicImage, toPublicProduct } from '../../utils/catalog'
import { canBlockProductDates, isBookableProductStatus, isPublicCatalogProductStatus } from '../../utils/constants'
import { catalogCardRate, parseHiddenPriceFields, visibleCatalogPrices } from '../../utils/price-visibility'
import {
  categoryInputSchema,
  equipmentInputSchema,
  productInputSchema,
  productListQuerySchema,
  publicProductListQuerySchema,
} from '../../utils/product-validation'
import { isUuid, normalizeSku, slugify } from '../../utils/slug'

const categoryRow = {
  uuid: '11111111-1111-4111-8111-111111111111',
  slug: 'cameras',
  name: 'Cameras',
  description: null,
  sort_order: 1,
  is_active: true,
}

const productRow = {
  uuid: '22222222-2222-4222-8222-222222222222',
  slug: 'sony-a7-iv',
  sku: 'CAM-A7IV',
  name: 'Sony A7 IV',
  description: 'Full-frame body',
  short_description: 'Hybrid stills and video',
  daily_price: 2500,
  weekly_price: 14000,
  monthly_price: null,
  deposit_amount: 10000,
  late_fee: 500,
  replacement_value: 180000,
  quantity: 3,
  reserved_quantity: 0,
  rented_quantity: 1,
  damaged_quantity: 0,
  maintenance_quantity: 0,
  lost_quantity: 0,
  available_quantity: 2,
  status: 'active' as const,
  condition: 'excellent',
  specifications: { sensor: '33MP' },
  included_accessories: ['Battery', 'Charger'],
  rental_rules: 'Return with battery charged.',
  model_path: null,
  is_featured: true,
  product_categories: categoryRow,
}

const validProduct = {
  name: 'Sony A7 IV',
  categoryUuid: '11111111-1111-4111-8111-111111111111',
  dailyPrice: 2500,
  depositAmount: 10000,
  lateFee: 500,
  quantity: 3,
}

describe('product validation', () => {
  it('accepts a valid product payload', () => {
    expect(productInputSchema.parse(validProduct)).toMatchObject({
      name: 'Sony A7 IV',
      status: 'draft',
    })
  })

  it('accepts admin price edits from form strings', () => {
    expect(productInputSchema.parse({
      ...validProduct,
      dailyPrice: '3750.50',
      weeklyPrice: '20000',
      monthlyPrice: '',
      depositAmount: '12000',
      lateFee: '750',
    })).toMatchObject({
      dailyPrice: 3750.5,
      weeklyPrice: 20000,
      monthlyPrice: null,
      depositAmount: 12000,
      lateFee: 750,
    })
  })

  it('rejects internal ids, unknown fields, and client-set slugs', () => {
    expect(productInputSchema.safeParse({
      ...validProduct,
      id: 12,
    }).success).toBe(false)
    expect(productInputSchema.safeParse({
      ...validProduct,
      slug: 'custom-slug',
    }).success).toBe(false)
    expect(productInputSchema.safeParse({
      ...validProduct,
      sku: 'CAM-A7IV',
    }).success).toBe(false)
    expect(categoryInputSchema.safeParse({
      name: 'Cameras',
      id: 4,
    }).success).toBe(false)
    expect(equipmentInputSchema.safeParse({
      assetCode: 'CAM-001',
      id: 9,
    }).success).toBe(false)
  })

  it('rejects negative prices', () => {
    expect(productInputSchema.safeParse({
      ...validProduct,
      dailyPrice: -1,
    }).success).toBe(false)
  })

  it('rejects inventory that exceeds total quantity', () => {
    const result = productInputSchema.safeParse({
      ...validProduct,
      quantity: 2,
      reservedQuantity: 1,
      rentedQuantity: 1,
      damagedQuantity: 1,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('cannot exceed total quantity')
    }
  })

  it('rejects extra list query fields', () => {
    expect(productListQuerySchema.safeParse({
      page: 1,
      id: 3,
    }).success).toBe(false)
  })

  it('keeps the public catalog query strict and status-free', () => {
    expect(publicProductListQuerySchema.parse({
      search: 'sony',
      categorySlug: 'cameras',
      featured: 'true',
    })).toMatchObject({
      featured: true,
      page: 1,
      pageSize: 12,
    })
    expect(publicProductListQuerySchema.safeParse({
      status: 'active',
    }).success).toBe(false)
    expect(publicProductListQuerySchema.safeParse({
      id: 9,
    }).success).toBe(false)
  })
})

describe('slug helpers', () => {
  it('slugifies names and normalizes SKUs', () => {
    expect(slugify('Sony A7 IV')).toBe('sony-a7-iv')
    expect(slugify('DJI Mini 4 Pro')).toBe('dji-mini-4-pro')
    expect(normalizeSku(' cam a7iv ')).toBe('CAM-A7IV')
    expect(isUuid('22222222-2222-4222-8222-222222222222')).toBe(true)
    expect(isUuid('sony-a7-iv')).toBe(false)
  })
})

describe('catalog mappers', () => {
  it('never includes internal ids in public payloads', () => {
    const category = toPublicCategory({ ...categoryRow, id: 4 } as typeof categoryRow & { id: number })
    const product = toPublicProduct(productRow, [{
      uuid: '33333333-3333-4333-8333-333333333333',
      storage_path: '22222222-2222-4222-8222-222222222222/cover.jpg',
      alt: 'Front',
      sort_order: 0,
    }], 'https://example.supabase.co')
    const image = toPublicImage({
      uuid: '33333333-3333-4333-8333-333333333333',
      storage_path: 'cover.jpg',
      alt: 'Front',
      sort_order: 0,
    }, 'https://example.supabase.co')
    const asset = toPublicAsset({
      uuid: '44444444-4444-4444-8444-444444444444',
      asset_code: 'CAM-001',
      serial_number: 'SN-1',
      condition: 'good',
      status: 'available',
      purchase_cost: 120000,
      purchase_date: '2024-01-15',
      replacement_value: 180000,
      notes: null,
      products: {
        uuid: productRow.uuid,
        name: productRow.name,
        sku: productRow.sku,
      },
    })

    for (const payload of [category, product, image, asset, product.category, asset.product]) {
      expect(payload).not.toHaveProperty('id')
    }

    expect(product.images[0]).not.toHaveProperty('id')
    expect(image.url).toContain('/storage/v1/object/public/product-images/cover.jpg')

    const catalog = toCatalogProduct(productRow, [], 'https://example.supabase.co')
    expect(catalog).not.toHaveProperty('id')
    expect(catalog).not.toHaveProperty('reservedQuantity')
    expect(catalog).not.toHaveProperty('status')
    expect(catalog.comingSoon).toBe(false)
    expect(catalog.availableQuantity).toBe(2)
    expect(toCatalogProduct({ ...productRow, status: 'coming_soon' }, [], 'https://example.supabase.co').comingSoon).toBe(true)
    expect(product.hiddenPriceFields).toEqual([])
  })

  it('hides selected catalog prices while admin payloads keep the amounts', () => {
    const hiddenRow = {
      ...productRow,
      hidden_price_fields: ['weekly', 'late_fee', 'replacement_value'],
    }
    const admin = toPublicProduct(hiddenRow, [], 'https://example.supabase.co')
    const catalog = toCatalogProduct(hiddenRow, [], 'https://example.supabase.co')

    expect(admin.hiddenPriceFields).toEqual(['weekly', 'lateFee', 'replacementValue'])
    expect(admin.weeklyPrice).toBe(14000)
    expect(admin.lateFee).toBe(500)
    expect(catalog.weeklyPrice).toBeNull()
    expect(catalog.lateFee).toBeNull()
    expect(catalog.replacementValue).toBeNull()
    expect(catalog.dailyPrice).toBe(2500)
    expect(catalog.depositAmount).toBe(10000)
    expect(visibleCatalogPrices(catalog).map(row => row.key)).toEqual(['daily', 'deposit'])
    expect(catalogCardRate({
      dailyPrice: null,
      weeklyPrice: 14000,
      monthlyPrice: null,
    })).toEqual({ amount: 14000, suffix: '/ week' })
    expect(parseHiddenPriceFields(['deposit', 'late_fee', 'deposit'])).toEqual(['deposit', 'lateFee'])
    expect(productInputSchema.parse({
      ...validProduct,
      hiddenPriceFields: ['lateFee', 'deposit', 'lateFee'],
    }).hiddenPriceFields).toEqual(['deposit', 'lateFee'])
  })

  it('accepts coming soon as a product status', () => {
    expect(productInputSchema.parse({
      ...validProduct,
      status: 'coming_soon',
    }).status).toBe('coming_soon')
    expect(isPublicCatalogProductStatus('coming_soon')).toBe(true)
    expect(isPublicCatalogProductStatus('hidden')).toBe(false)
    expect(isBookableProductStatus('coming_soon')).toBe(false)
    expect(isBookableProductStatus('active')).toBe(true)
    expect(canBlockProductDates('coming_soon')).toBe(false)
    expect(canBlockProductDates('active')).toBe(true)
  })

  it('blocks product delete when rental or asset history exists', () => {
    expect(canDeleteProduct({ rentalItems: 0, assignments: 0 })).toBe(true)
    expect(canDeleteProduct({ rentalItems: 1, assignments: 0 })).toBe(false)
    expect(canDeleteProduct({ rentalItems: 0, assignments: 2 })).toBe(false)
  })
})
