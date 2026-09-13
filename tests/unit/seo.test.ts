import { describe, expect, it } from 'vitest'
import { aboutPageJsonLd, breadcrumbJsonLd, collectionJsonLd, defaultOgImage, howToJsonLd, isPrivatePath, organizationJsonLd, productJsonLd, publicSitemapPaths, siteCanonical, siteRobots, websiteJsonLd } from '../../utils/seo'

describe('siteCanonical', () => {
  it('joins origin and path without a double slash', () => {
    expect(siteCanonical('https://lumen.test/', '/products')).toBe('https://lumen.test/products')
    expect(siteCanonical('https://lumen.test', 'products/sony-a7')).toBe('https://lumen.test/products/sony-a7')
  })
})

describe('site robots', () => {
  it('marks account and admin paths as noindex', () => {
    expect(isPrivatePath('/admin/reports')).toBe(true)
    expect(isPrivatePath('/dashboard')).toBe(true)
    expect(siteRobots('/login')).toBe('noindex, nofollow')
    expect(siteRobots('/accept-policies')).toBe('noindex, nofollow')
    expect(siteRobots('/products')).toBe('index, follow')
    expect(siteRobots('/')).toBe('index, follow')
    expect(siteRobots('/privacy')).toBe('index, follow')
    expect(siteRobots('/terms')).toBe('index, follow')
  })
})

describe('organization JSON-LD', () => {
  it('uses the public site name, Davao address, and Facebook profile', () => {
    const json = organizationJsonLd('https://lumen.test')
    expect(json.name).toBe('JRY Rentals')
    expect(json.url).toBe('https://lumen.test/')
    expect(json['@type']).toBe('LocalBusiness')
    expect(json.address.addressLocality).toBe('Davao City')
    expect(json.sameAs).toContain('https://www.facebook.com/jryrentals/')
    expect(defaultOgImage('https://lumen.test')).toBe('https://lumen.test/og.png')
    expect(publicSitemapPaths()).toEqual(['/', '/products', '/about', '/privacy', '/terms'])
    expect(websiteJsonLd('https://lumen.test').potentialAction['query-input']).toBe('required name=search_term_string')
  })

  it('describes a catalog product without exposing internal ids', () => {
    const json = productJsonLd('https://lumen.test', {
      slug: 'dji-air-3',
      name: 'DJI Air 3',
      description: 'Dual-camera drone.',
      sku: 'DRN-AIR3-001',
      dailyPrice: 3500,
      availableQuantity: 1,
      images: [{ url: 'https://cdn.example/drone.png' }],
    })
    const crumbs = breadcrumbJsonLd('https://lumen.test', [
      { name: 'Home', path: '/' },
      { name: 'Equipment', path: '/products' },
    ])

    expect(json).not.toHaveProperty('id')
    expect(json.offers.priceCurrency).toBe('PHP')
    expect(json.offers.availability).toContain('InStock')
    expect(crumbs.itemListElement[1].item).toBe('https://lumen.test/products')
    expect(howToJsonLd().step).toHaveLength(3)
    expect(aboutPageJsonLd('https://lumen.test').url).toBe('https://lumen.test/about')
    expect(collectionJsonLd('https://lumen.test', [{ slug: 'dji-air-3', name: 'DJI Air 3' }]).mainEntity.itemListElement[0].url)
      .toBe('https://lumen.test/products/dji-air-3')
  })
})
