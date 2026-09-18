import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  DEFAULT_MAINTENANCE_TITLE,
  isMaintenanceBypassApiPath,
  isMaintenanceBypassPath,
  isMaintenanceImageType,
  maintenanceProductsFromCatalog,
  toPublicMaintenanceProduct,
  toPublicMaintenanceStatus,
} from '../../utils/maintenance'
import { maintenanceInputSchema } from '../../utils/maintenance-validation'

describe('maintenance validation', () => {
  it('accepts a message payload and rejects internal ids', () => {
    expect(maintenanceInputSchema.parse({
      enabled: true,
      title: 'We\'ll be right back',
      message: 'The storefront is closed today for inventory.',
    })).toMatchObject({
      enabled: true,
      title: 'We\'ll be right back',
    })

    expect(maintenanceInputSchema.safeParse({
      enabled: true,
      title: 'Closed',
      message: 'Back tomorrow.',
      id: 1,
    }).success).toBe(false)
  })

  it('requires a title and explanation', () => {
    expect(maintenanceInputSchema.safeParse({
      enabled: false,
      title: '',
      message: 'Back soon.',
    }).success).toBe(false)

    expect(maintenanceInputSchema.safeParse({
      enabled: false,
      title: 'Closed',
      message: '',
    }).success).toBe(false)
  })
})

describe('maintenance mapping', () => {
  it('never includes internal ids or storage paths on the public payload', () => {
    const payload = toPublicMaintenanceStatus({
      uuid: '11111111-1111-1111-1111-111111111111',
      is_enabled: true,
      title: 'Kit check',
      message: 'We are photographing inventory today.',
    }, [{
      uuid: '22222222-2222-4222-8222-222222222222',
      storage_path: 'notice.jpg',
      alt: 'Closed sign',
      sort_order: 0,
    }], 'https://example.supabase.co')

    expect(payload).not.toHaveProperty('id')
    expect(payload.enabled).toBe(true)
    expect(payload.images[0]).not.toHaveProperty('id')
    expect(payload.images[0]).not.toHaveProperty('storagePath')
    expect(payload.images[0]?.url).toContain('/storage/v1/object/public/maintenance-images/notice.jpg')
    expect(payload.products).toHaveLength(3)
    expect(payload.products.map(product => product.slug)).toEqual([
      'starlink-mini',
      'dji-air-3',
      'dji-osmo-360',
    ])
  })

  it('keeps the Osmo kit instead of a Sony catalog row', () => {
    expect(maintenanceProductsFromCatalog([
      {
        slug: 'sony-a7-iv',
        name: 'Sony A7 IV',
        category: { slug: 'cameras' },
        images: [{ url: 'https://cdn.example/sony.png' }],
      },
      {
        slug: 'starlink-mini',
        name: 'Starlink Mini',
        category: { slug: 'starlink' },
        images: [{ url: 'https://cdn.example/starlink.png' }],
      },
    ]).map(product => product.slug)).toEqual([
      'starlink-mini',
      'dji-air-3',
      'dji-osmo-360',
    ])
  })

  it('maps catalog kits without extra product fields', () => {
    expect(toPublicMaintenanceProduct({
      slug: 'dji-air-3',
      name: 'DJI Air 3',
      category: { slug: 'drones' },
      images: [{ url: 'https://cdn.example/drone.png' }],
    })).toEqual({
      slug: 'dji-air-3',
      name: 'DJI Air 3',
      categorySlug: 'drones',
      imageUrl: 'https://cdn.example/drone.png',
    })
  })

  it('falls back to the default title, explanation, and kit images', () => {
    expect(toPublicMaintenanceStatus(null)).toMatchObject({
      enabled: false,
      title: DEFAULT_MAINTENANCE_TITLE,
      message: DEFAULT_MAINTENANCE_MESSAGE,
      images: [],
      products: [
        { slug: 'starlink-mini', name: 'Starlink Mini' },
        { slug: 'dji-air-3', name: 'DJI Air 3' },
        { slug: 'dji-osmo-360', name: 'DJI Osmo 360' },
      ],
    })
  })
})

describe('maintenance access', () => {
  it('lets admins and auth pages through while blocking the storefront', () => {
    expect(isMaintenanceBypassPath('/admin/settings')).toBe(true)
    expect(isMaintenanceBypassPath('/login')).toBe(true)
    expect(isMaintenanceBypassPath('/maintenance')).toBe(true)
    expect(isMaintenanceBypassPath('/products')).toBe(false)
    expect(isMaintenanceBypassPath('/dashboard')).toBe(false)

    expect(isMaintenanceBypassApiPath('/api/maintenance')).toBe(true)
    expect(isMaintenanceBypassApiPath('/api/maintenance/chat')).toBe(true)
    expect(isMaintenanceBypassApiPath('/api/admin/maintenance')).toBe(true)
    expect(isMaintenanceBypassApiPath('/api/auth/me')).toBe(true)
    expect(isMaintenanceBypassApiPath('/api/payments/webhook')).toBe(true)
    expect(isMaintenanceBypassApiPath('/api/cookie-policy/current')).toBe(true)
    expect(isMaintenanceBypassApiPath('/api/products')).toBe(false)
    expect(isMaintenanceBypassApiPath('/api/rentals')).toBe(false)
  })

  it('accepts JPG, PNG, and WebP uploads', () => {
    expect(isMaintenanceImageType('image/jpeg')).toBe(true)
    expect(isMaintenanceImageType('image/png')).toBe(true)
    expect(isMaintenanceImageType('application/pdf')).toBe(false)
  })
})
