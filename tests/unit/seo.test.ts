import { describe, expect, it } from 'vitest'
import { aboutPageJsonLd, breadcrumbJsonLd, catalogIndexState, collectionJsonLd, defaultOgImage, howToJsonLd, isPrivatePath, organizationJsonLd, productJsonLd, publicSitemapPaths, renderSitemap, robotsTxt, siteCanonical, siteRobots, websiteJsonLd } from '../../utils/seo'

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
    expect(isPrivatePath('/maintenance')).toBe(true)
    expect(isPrivatePath('/waivers/sign/11111111-1111-4111-8111-111111111111')).toBe(true)
    expect(siteRobots('/login')).toBe('noindex, nofollow')
    expect(siteRobots('/maintenance')).toBe('noindex, nofollow')
    expect(siteRobots('/accept-policies')).toBe('noindex, nofollow')
    expect(siteRobots('/products')).toBe('index, follow')
    expect(siteRobots('/')).toBe('index, follow')
    expect(siteRobots('/privacy')).toBe('index, follow')
    expect(siteRobots('/terms')).toBe('index, follow')
    expect(siteRobots('/cookies')).toBe('index, follow')
    expect(isPrivatePath('/feedback/abc')).toBe(true)
    expect(isPrivatePath('/commissioner')).toBe(true)
    expect(siteRobots('/feedback/abc')).toBe('noindex, nofollow')
  })

  it('indexes a category page and keeps search results out', () => {
    expect(catalogIndexState({})).toMatchObject({ path: '/products', robots: 'index, follow' })
    expect(catalogIndexState({ category: 'drones' })).toMatchObject({
      path: '/products?category=drones',
      robots: 'index, follow',
      indexable: true,
    })
    expect(catalogIndexState({ category: 'drones', search: 'mini' }).robots).toBe('noindex, follow')
    expect(catalogIndexState({ page: 2 }).robots).toBe('noindex, follow')
  })

  it('publishes robots and a sitemap without private urls', () => {
    const robots = robotsTxt('https://jryrentals.com')
    expect(robots).toContain('Disallow: /feedback')
    expect(robots).toContain('Disallow: /commissioner')
    expect(robots).toContain('Sitemap: https://jryrentals.com/sitemap.xml')

    const xml = renderSitemap([
      { loc: 'https://jryrentals.com/products?category=drones' },
      { loc: 'https://jryrentals.com/products/starlink', lastmod: '2026-11-19T00:00:00.000Z' },
    ])
    expect(xml).toContain('<loc>https://jryrentals.com/products?category=drones</loc>')
    expect(xml).toContain('<lastmod>2026-11-19</lastmod>')
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
    expect(json.sameAs).toContain('https://www.instagram.com/jryrentals')
    expect(defaultOgImage('https://lumen.test')).toBe('https://lumen.test/og.png')
    expect(publicSitemapPaths()).toEqual(['/', '/products', '/about', '/faq', '/privacy', '/terms', '/cookies'])
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
    expect(howToJsonLd().step.map(step => step.name)).toContain('Message us to confirm')
    expect(aboutPageJsonLd('https://lumen.test').url).toBe('https://lumen.test/about')
    expect(collectionJsonLd('https://lumen.test', [{ slug: 'dji-air-3', name: 'DJI Air 3' }]).mainEntity.itemListElement[0].url)
      .toBe('https://lumen.test/products/dji-air-3')
  })
})
