import { describe, expect, it } from 'vitest'
import type { CatalogProduct } from '../../types/catalog'
import { answerFromCatalog, catalogActions, catalogFacts, policyFacts } from '../../utils/chat-knowledge'

function product(overrides: Partial<CatalogProduct>): CatalogProduct {
  return {
    uuid: 'p',
    slug: 'starlink-mini',
    sku: 'SKU',
    name: 'Starlink Mini',
    description: '',
    shortDescription: 'Portable satellite internet.',
    category: { uuid: 'c', slug: 'starlink', name: 'Starlink', description: null, sortOrder: 0 } as CatalogProduct['category'],
    dailyPrice: 1000,
    weeklyPrice: 5000,
    monthlyPrice: null,
    longStayLess: 100,
    longStayMinDays: 3,
    depositAmount: 500,
    lateFee: 300,
    replacementValue: null,
    availableQuantity: 2,
    condition: 'good',
    specifications: { downlink: 'up to 100 Mbps' },
    includedAccessories: ['Power supply', 'Carry case'],
    rentalRules: 'Return with all cables.',
    isFeatured: true,
    comingSoon: false,
    images: [],
    ...overrides,
  }
}

const catalog = [
  product({}),
  product({ uuid: 'a', slug: 'dji-air-3', name: 'DJI Air 3', comingSoon: true, includedAccessories: ['RC'] }),
  product({ uuid: 'o', slug: 'dji-osmo-360', name: 'DJI OSMO 360', comingSoon: true }),
]

describe('chat knowledge from the live catalog', () => {
  it('answers specs and what is included for the right item', () => {
    const reply = answerFromCatalog('What is included with the Starlink Mini?', catalog, {}, [])
    expect(reply).toContain('₱1,000.00 per day')
    expect(reply).toContain('Included: Power supply, Carry case.')
    expect(answerFromCatalog('specs of the DJI Air 3?', catalog, {}, [])).toContain('DJI Air 3 is coming soon')
    expect(answerFromCatalog('specs of the DJI Air 3?', catalog, {}, [])).not.toContain('OSMO')
  })

  it('answers payment methods, late fees, and the equipment list', () => {
    expect(answerFromCatalog('What payment methods do you accept?', catalog, {}, ['GCash', 'Maya'])).toContain('GCash, Maya')
    expect(answerFromCatalog('What if I return late?', catalog, {}, [])).toContain('₱300 under 6 hours late')
    expect(answerFromCatalog('What equipment do you have?', catalog, {}, [])).toBe('Available to book: Starlink Mini. Coming soon: DJI Air 3, DJI OSMO 360.')
  })

  it('knows unit counts but keeps long-stay discounts and weekly prices out', () => {
    const facts = catalogFacts(catalog)
    expect(facts).toContain('units in the shop: 2')
    expect(facts).not.toMatch(/long-stay|weekly|₱5,000/i)
    expect(policyFacts({}, ['GCash'])).toContain('Payment methods: GCash')
    expect(answerFromCatalog('How many Starlink Mini do you have?', catalog, {}, [])).toContain('We have 2 units of Starlink Mini')
  })

  it('adds book buttons for bookable items and view buttons for coming soon', () => {
    expect(catalogActions('Tell me about the Starlink Mini', catalog)).toEqual([
      { kind: 'book', label: 'Book Starlink Mini', to: '/rentals/new?product=starlink-mini' },
    ])
    expect(catalogActions('specs of the DJI Air 3', catalog)).toEqual([
      { kind: 'view', label: 'View DJI Air 3', to: '/products/dji-air-3' },
    ])
    expect(catalogActions('What equipment do you have?', catalog).map(action => action.label)).toEqual(['Book Starlink Mini'])
    expect(catalogActions('Where are you located?', catalog)).toEqual([])
  })
})
