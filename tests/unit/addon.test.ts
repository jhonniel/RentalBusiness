import { describe, expect, it } from 'vitest'
import { quoteAddonLine, sumAddonQuoteLines, toPublicAddon } from '../../utils/addon'
import { addonInputSchema, rentalAddonsField } from '../../utils/addon-validation'

describe('quoteAddonLine', () => {
  it('charges a flat fee for the booking', () => {
    expect(quoteAddonLine({ unitPrice: 100, quantity: 1 })).toEqual({
      unitPrice: 100,
      quantity: 1,
      lineTotal: 100,
    })
    expect(quoteAddonLine({ unitPrice: 150, quantity: 1 })).toEqual({
      unitPrice: 150,
      quantity: 1,
      lineTotal: 150,
    })
  })
})

describe('addon helpers', () => {
  it('maps stock and available counts', () => {
    expect(toPublicAddon({
      uuid: '11111111-1111-1111-1111-111111111111',
      name: 'Battery',
      description: '',
      unit_price: 200,
      quantity: 5,
      bookable: true,
      status: 'active',
      held_quantity: 2,
      updated_at: null,
    })).toMatchObject({
      available: 3,
      heldQuantity: 2,
      bookable: true,
      imageUrl: null,
    })
    expect(toPublicAddon({
      uuid: '11111111-1111-1111-1111-111111111111',
      name: 'Battery',
      description: '',
      unit_price: 200,
      quantity: 5,
      bookable: true,
      status: 'active',
      image_storage_path: '11111111-1111-1111-1111-111111111111/a.jpg',
      held_quantity: 0,
      updated_at: null,
    }, 'https://example.supabase.co')).toMatchObject({
      imageUrl: 'https://example.supabase.co/storage/v1/object/public/addon-images/11111111-1111-1111-1111-111111111111/a.jpg',
    })
  })

  it('sums quote lines', () => {
    expect(sumAddonQuoteLines([
      { uuid: 'a', name: 'A', quantity: 1, unitPrice: 100, lineTotal: 100, available: 1 },
      { uuid: 'b', name: 'B', quantity: 2, unitPrice: 50, lineTotal: 200, available: 2 },
    ])).toBe(300)
  })
})

describe('addon validation', () => {
  it('accepts add-on input', () => {
    expect(addonInputSchema.parse({
      name: 'Tripod',
      unitPrice: 100,
      quantity: 3,
      bookable: true,
    })).toMatchObject({ name: 'Tripod', unitPrice: 100, quantity: 3, bookable: true })
  })

  it('accepts empty add-on selections', () => {
    expect(rentalAddonsField.parse(undefined)).toEqual([])
  })
})
