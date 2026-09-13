import { describe, expect, it } from 'vitest'
import {
  categoryBlurb,
  categoryVisual,
  preferredCategories,
  productHighlights,
  productVisual,
  resolvedProductImage,
} from '../../utils/storefront'

describe('storefront visuals', () => {
  it('maps known categories and products to local images', () => {
    expect(categoryVisual('drones')).toBe('/storefront/drone.png?v=10')
    expect(productVisual('starlink-mini')).toBe('/storefront/starlink.png?v=10')
    expect(productVisual('unknown', 'lenses')).toBe('/storefront/lens.jpg')
    expect(resolvedProductImage('sony-a7-iv', 'cameras', 'https://cdn.example/tiny.png'))
      .toBe('/storefront/action-camera.png?v=11')
    expect(resolvedProductImage('unknown-kit', 'lenses', 'https://cdn.example/lens.png'))
      .toBe('https://cdn.example/lens.png')
  })

  it('keeps highlights short and prefers specifications', () => {
    expect(productHighlights({
      specifications: { sensor: '33MP', video: '4K60' },
      includedAccessories: ['Battery', 'Strap'],
    })).toEqual(['33MP', '4K60', 'Battery'])
  })

  it('orders showcase categories for the storefront', () => {
    const slugs = preferredCategories([
      { slug: 'audio' },
      { slug: 'starlink' },
      { slug: 'drones' },
      { slug: 'cameras' },
    ]).map(item => item.slug)

    expect(slugs).toEqual(['drones', 'cameras', 'starlink', 'audio'])
    expect(categoryBlurb('starlink')).toContain('connected')
  })
})
