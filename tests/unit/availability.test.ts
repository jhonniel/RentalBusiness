import { describe, expect, it } from 'vitest'
import {
  bookedQuantityFromRentals,
  evaluateAvailability,
  rentableCapacity,
  unavailableDates,
  type AvailabilityBooking,
} from '../../utils/availability'
import { availabilityQuerySchema } from '../../utils/product-validation'

const camera = '22222222-2222-4222-8222-222222222222'
const drone = '55555555-5555-4555-8555-555555555555'

function booking(overrides: Partial<AvailabilityBooking> = {}): AvailabilityBooking {
  return {
    productUuid: camera,
    quantity: 3,
    startsOn: '2026-09-10',
    endsOn: '2026-09-12',
    status: 'approved',
    ...overrides,
  }
}

describe('availability query', () => {
  it('accepts a same-day range and rejects internal ids', () => {
    expect(availabilityQuerySchema.parse({
      productSlug: 'starlink-mini',
      startsOn: '2026-09-11',
      endsOn: '2026-09-11',
    })).toMatchObject({ quantity: 1 })

    expect(availabilityQuerySchema.safeParse({
      productSlug: 'starlink-mini',
      startsOn: '2026-09-11',
      endsOn: '2026-09-10',
    }).success).toBe(false)

    expect(availabilityQuerySchema.safeParse({
      productId: 4,
      startsOn: '2026-09-11',
      endsOn: '2026-09-13',
    }).success).toBe(false)
  })
})

describe('rentable capacity', () => {
  it('removes maintenance, damaged, and lost units from the pool', () => {
    expect(rentableCapacity({
      quantity: 5,
      damagedQuantity: 1,
      maintenanceQuantity: 1,
      lostQuantity: 0,
    })).toBe(3)
  })
})

describe('overlap-aware booking totals', () => {
  it('blocks the overlapping Sept 10-12 and Sept 11-13 request', () => {
    const booked = bookedQuantityFromRentals(
      [booking()],
      camera,
      '2026-09-11',
      '2026-09-13',
    )

    expect(booked).toBe(3)
    expect(evaluateAvailability({
      quantity: 5,
      damagedQuantity: 0,
      maintenanceQuantity: 0,
      lostQuantity: 0,
      bookedQuantity: booked,
      requestedQuantity: 3,
    })).toMatchObject({
      available: 2,
      canFulfill: false,
    })
  })

  it('allows multiple units when stock remains', () => {
    const result = evaluateAvailability({
      quantity: 5,
      damagedQuantity: 0,
      maintenanceQuantity: 0,
      lostQuantity: 0,
      bookedQuantity: 3,
      requestedQuantity: 2,
    })

    expect(result.canFulfill).toBe(true)
    expect(result.available).toBe(2)
  })

  it('treats same-day rentals as occupying that calendar day', () => {
    expect(bookedQuantityFromRentals(
      [booking({ startsOn: '2026-09-12', endsOn: '2026-09-12' })],
      camera,
      '2026-09-12',
      '2026-09-12',
    )).toBe(3)

    expect(bookedQuantityFromRentals(
      [booking({ startsOn: '2026-09-12', endsOn: '2026-09-12' })],
      camera,
      '2026-09-13',
      '2026-09-14',
    )).toBe(0)
  })

  it('does not let one product consume another product\'s stock', () => {
    expect(bookedQuantityFromRentals(
      [booking(), booking({ productUuid: drone, quantity: 2 })],
      camera,
      '2026-09-10',
      '2026-09-12',
    )).toBe(3)
  })

  it('releases cancelled and returned rentals', () => {
    expect(bookedQuantityFromRentals(
      [
        booking({ status: 'cancelled' }),
        booking({ status: 'returned', quantity: 2 }),
        booking({ status: 'completed', quantity: 1 }),
      ],
      camera,
      '2026-09-10',
      '2026-09-12',
    )).toBe(0)
  })

  it('keeps pending and overdue rentals in the occupying set', () => {
    expect(bookedQuantityFromRentals(
      [
        booking({ status: 'pending', quantity: 1 }),
        booking({ status: 'overdue', quantity: 1 }),
      ],
      camera,
      '2026-09-11',
      '2026-09-11',
    )).toBe(2)
  })

  it('can ignore one rental when checking an update', () => {
    expect(bookedQuantityFromRentals(
      [booking({ rentalUuid: 'rent-1' }), booking({ rentalUuid: 'rent-2', quantity: 1 })],
      camera,
      '2026-09-10',
      '2026-09-12',
      'rent-1',
    )).toBe(1)
  })

  it('marks days unavailable when a pending request already fills the only unit', () => {
    expect(unavailableDates({
      stock: {
        quantity: 1,
        damagedQuantity: 0,
        maintenanceQuantity: 0,
        lostQuantity: 0,
      },
      bookings: [booking({ status: 'pending', quantity: 1, startsOn: '2026-09-13', endsOn: '2026-09-13' })],
      productUuid: camera,
      requestedQuantity: 1,
      from: '2026-09-12',
      to: '2026-09-14',
    })).toEqual(['2026-09-13'])
  })

  it('lists calendar days that cannot fulfill the requested quantity', () => {
    expect(unavailableDates({
      stock: {
        quantity: 1,
        damagedQuantity: 0,
        maintenanceQuantity: 0,
        lostQuantity: 0,
      },
      bookings: [booking({ quantity: 1, startsOn: '2026-09-12', endsOn: '2026-09-13' })],
      productUuid: camera,
      requestedQuantity: 1,
      from: '2026-09-11',
      to: '2026-09-14',
    })).toEqual(['2026-09-12', '2026-09-13'])
  })

  it('reduces capacity when units are in maintenance', () => {
    expect(evaluateAvailability({
      quantity: 5,
      damagedQuantity: 0,
      maintenanceQuantity: 2,
      lostQuantity: 0,
      bookedQuantity: 2,
      requestedQuantity: 2,
    })).toMatchObject({
      capacity: 3,
      available: 1,
      canFulfill: false,
    })
  })
})
