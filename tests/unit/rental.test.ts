import { describe, expect, it } from 'vitest'
import { canTransitionRentalStatus } from '../../utils/rental-status'
import { isRentalCode, toPublicRental } from '../../utils/rental'
import { createRentalSchema, rentalQuoteQuerySchema } from '../../utils/rental-validation'

describe('rental validation', () => {
  it('accepts a customer request and rejects priced or privileged fields', () => {
    expect(createRentalSchema.parse({
      productSlug: 'sony-a7-iv',
      startsOn: '2026-09-11',
      endsOn: '2026-09-13',
      quantity: 1,
      firstName: 'Ana',
      lastName: 'Reyes',
    })).toMatchObject({ status: 'pending' })

    expect(createRentalSchema.safeParse({
      productSlug: 'sony-a7-iv',
      startsOn: '2026-09-11',
      endsOn: '2026-09-13',
      firstName: 'Ana',
      lastName: 'Reyes',
      status: 'approved',
    }).success).toBe(false)

    expect(createRentalSchema.safeParse({
      productSlug: 'sony-a7-iv',
      startsOn: '2026-09-11',
      endsOn: '2026-09-13',
      firstName: 'Ana',
      lastName: 'Reyes',
      id: 9,
      totalAmount: 1,
    }).success).toBe(false)
  })

  it('rejects a quote that includes an internal product id', () => {
    expect(rentalQuoteQuerySchema.safeParse({
      productId: 3,
      startsOn: '2026-09-11',
      endsOn: '2026-09-13',
    }).success).toBe(false)
  })
})

describe('rental mapper', () => {
  it('never includes internal ids', () => {
    const rental = toPublicRental({
      uuid: '66666666-6666-4666-8666-666666666666',
      code: 'LUM-20260913-00001',
      status: 'pending',
      starts_on: '2026-09-11',
      ends_on: '2026-09-13',
      subtotal: 10500,
      deposit_amount: 20000,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: 10500,
      notes: null,
      created_at: '2026-09-13T00:00:00.000Z',
      rental_items: [{
        uuid: '77777777-7777-4777-8777-777777777777',
        quantity: 1,
        daily_price: 3500,
        line_total: 10500,
        products: {
          uuid: '22222222-2222-4222-8222-222222222222',
          slug: 'sony-a7-iv',
          name: 'Sony A7 IV',
          sku: 'CAM-A7IV-001',
        },
      }],
    })

    expect(rental).not.toHaveProperty('id')
    expect(rental.waiver).toBeNull()
    expect(rental.payments).toEqual([])
    expect(rental.receipts).toEqual([])
    expect(rental.customer).toBeNull()
    expect(rental.items[0]).not.toHaveProperty('id')
    expect(rental.items[0]?.product).not.toHaveProperty('id')
    expect(isRentalCode(rental.code)).toBe(true)
  })
})

describe('customer rental transitions', () => {
  it('lets customers cancel draft or pending requests only', () => {
    expect(canTransitionRentalStatus('draft', 'cancelled')).toBe(true)
    expect(canTransitionRentalStatus('pending', 'cancelled')).toBe(true)
    expect(canTransitionRentalStatus('awaiting_payment', 'cancelled')).toBe(true)
    expect(canTransitionRentalStatus('active', 'cancelled')).toBe(false)
  })
})
