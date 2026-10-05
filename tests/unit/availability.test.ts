import { describe, expect, it } from 'vitest'
import {
  blockedDatesFromRanges,
  bookedQuantityFromRentals,
  datesWithBookings,
  evaluateAvailability,
  firstOpenPickupTime,
  mergeUnavailableDates,
  rangeIncludesUnavailableDates,
  rangeOverlapsBlockedDates,
  rentableCapacity,
  unavailableDates,
  unavailablePickupTimes,
  type AvailabilityBooking,
} from '../../utils/availability'
import { addCalendarDays } from '../../utils/expense'
import { calendarDateInZone } from '../../utils/datetime'
import { availabilityQuerySchema, blockedDateInputSchema } from '../../utils/product-validation'

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
    const today = calendarDateInZone()
    expect(availabilityQuerySchema.parse({
      productSlug: 'starlink-mini',
      startsOn: addCalendarDays(today, 1),
      endsOn: addCalendarDays(today, 2),
      pickupTime: '13:00',
    })).toMatchObject({ quantity: 1, pickupTime: '13:00' })

    expect(availabilityQuerySchema.safeParse({
      productSlug: 'starlink-mini',
      startsOn: today,
      endsOn: addCalendarDays(today, -1),
    }).success).toBe(false)

    expect(availabilityQuerySchema.safeParse({
      productId: 4,
      startsOn: today,
      endsOn: addCalendarDays(today, 2),
    }).success).toBe(false)

    expect(availabilityQuerySchema.safeParse({
      productSlug: 'starlink-mini',
      startsOn: addCalendarDays(today, -1),
      endsOn: addCalendarDays(today, -1),
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

  it('keeps leftover stock but treats a booked day as taken', () => {
    const result = evaluateAvailability({
      quantity: 5,
      damagedQuantity: 0,
      maintenanceQuantity: 0,
      lostQuantity: 0,
      bookedQuantity: 3,
      requestedQuantity: 2,
    })

    expect(result.available).toBe(2)
    expect(result.canFulfill).toBe(false)
  })

  it('counts overlapping bookings even when dates arrive as timestamps', () => {
    expect(bookedQuantityFromRentals(
      [booking({ startsOn: '2026-09-12T00:00:00.000Z', endsOn: '2026-09-12T00:00:00.000Z' })],
      camera,
      '2026-09-12',
      '2026-09-12',
    )).toBe(3)
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

  it('blocks a stay that passes through a booked day', () => {
    expect(rangeIncludesUnavailableDates('2026-09-10', '2026-09-14', ['2026-09-12'])).toBe(true)
    expect(rangeIncludesUnavailableDates('2026-09-10', '2026-09-11', ['2026-09-12'])).toBe(false)
    expect(rangeIncludesUnavailableDates('2026-09-12', '2026-09-12', ['2026-09-12'])).toBe(true)
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

  it('rejects a range that includes an admin-blocked day', () => {
    expect(evaluateAvailability({
      quantity: 5,
      damagedQuantity: 0,
      maintenanceQuantity: 0,
      lostQuantity: 0,
      bookedQuantity: 0,
      requestedQuantity: 1,
      hasBlockedDates: true,
    }).canFulfill).toBe(false)

    expect(rangeOverlapsBlockedDates('2026-09-10', '2026-09-12', [
      { startsOn: '2026-09-12', endsOn: '2026-09-14' },
    ])).toBe(true)

    expect(rangeOverlapsBlockedDates('2026-09-10', '2026-09-11', [
      { startsOn: '2026-09-12', endsOn: '2026-09-14' },
    ])).toBe(false)

    expect(blockedDatesFromRanges(
      [{ startsOn: '2026-09-12', endsOn: '2026-09-13' }],
      '2026-09-11',
      '2026-09-14',
    )).toEqual(['2026-09-12', '2026-09-13'])

    expect(mergeUnavailableDates(['2026-09-12'], ['2026-09-12', '2026-09-13'])).toEqual([
      '2026-09-12',
      '2026-09-13',
    ])
  })

  it('accepts a same-day admin block and rejects a reversed or past range', () => {
    const today = calendarDateInZone()
    expect(blockedDateInputSchema.parse({
      startsOn: today,
      endsOn: today,
      reason: 'Holiday',
    })).toMatchObject({ reason: 'Holiday' })

    expect(blockedDateInputSchema.safeParse({
      startsOn: addCalendarDays(today, 1),
      endsOn: today,
    }).success).toBe(false)

    expect(blockedDateInputSchema.safeParse({
      startsOn: addCalendarDays(today, -1),
      endsOn: addCalendarDays(today, -1),
    }).success).toBe(false)
  })

  it('keeps the return day bookable after the kit is due back', () => {
    expect(unavailableDates({
      stock: {
        quantity: 1,
        damagedQuantity: 0,
        maintenanceQuantity: 0,
        lostQuantity: 0,
      },
      bookings: [booking({
        quantity: 1,
        startsOn: '2026-10-05',
        endsOn: '2026-10-06',
        pickupAt: '2026-10-05T05:00:00.000Z',
        returnAt: '2026-10-06T05:00:00.000Z',
      })],
      productUuid: camera,
      requestedQuantity: 1,
      from: '2026-10-05',
      to: '2026-10-07',
    })).toEqual(['2026-10-05'])

    expect(datesWithBookings({
      bookings: [booking({
        quantity: 1,
        startsOn: '2026-10-05',
        endsOn: '2026-10-06',
        pickupAt: '2026-10-05T05:00:00.000Z',
        returnAt: '2026-10-06T05:00:00.000Z',
      })],
      productUuid: camera,
      from: '2026-10-05',
      to: '2026-10-07',
    })).toEqual(['2026-10-05', '2026-10-06'])
  })

  it('disables pickup times that overlap a live rental window', () => {
    const taken = unavailablePickupTimes({
      bookings: [booking({
        quantity: 1,
        startsOn: '2026-10-05',
        endsOn: '2026-10-06',
        pickupAt: '2026-10-05T05:00:00.000Z',
        returnAt: '2026-10-06T05:00:00.000Z',
      })],
      productUuid: camera,
      startsOn: '2026-10-06',
      endsOn: '2026-10-07',
    })

    expect(taken).toContain('09:00')
    expect(taken).toContain('12:30')
    expect(taken).not.toContain('13:00')
    expect(firstOpenPickupTime(taken)).toBe('13:00')
  })

  it('compares occupying windows by instant so timezone suffixes still block morning slots', () => {
    const taken = unavailablePickupTimes({
      bookings: [booking({
        quantity: 1,
        startsOn: '2026-10-05',
        endsOn: '2026-10-06',
        pickupAt: '2026-10-05T13:00:00+08:00',
        returnAt: '2026-10-06T13:00:00+08:00',
      })],
      productUuid: camera,
      startsOn: '2026-10-06',
      endsOn: '2026-10-07',
    })

    expect(taken).toContain('08:00')
    expect(taken).toContain('12:30')
    expect(taken).not.toContain('13:00')
  })

  it('blocks every shop time on a date-only occupying day', () => {
    const taken = unavailablePickupTimes({
      bookings: [booking({
        quantity: 1,
        startsOn: '2026-10-05',
        endsOn: '2026-10-06',
      })],
      productUuid: camera,
      startsOn: '2026-10-06',
      endsOn: '2026-10-07',
    })

    expect(taken).toContain('08:00')
    expect(taken).toContain('13:00')
    expect(taken).toContain('20:00')
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
