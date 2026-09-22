import type { RentalStatus } from './constants'
import { inclusiveDayCount } from './datetime'
import { datesOverlapInclusive, rentalOccupiesInventory } from './rental-status'

export interface AvailabilityStock {
  quantity: number
  damagedQuantity: number
  maintenanceQuantity: number
  lostQuantity: number
}

export interface AvailabilityInput extends AvailabilityStock {
  bookedQuantity: number
  requestedQuantity: number
  hasBlockedDates?: boolean
}

export interface BlockedDateRange {
  startsOn: string
  endsOn: string
}

export interface AvailabilityResult {
  capacity: number
  booked: number
  available: number
  requested: number
  canFulfill: boolean
}

export interface AvailabilityBooking {
  productUuid: string
  quantity: number
  startsOn: string
  endsOn: string
  status: RentalStatus
  rentalUuid?: string
}

export function rentableCapacity(stock: AvailabilityStock): number {
  return Math.max(
    0,
    stock.quantity - stock.damagedQuantity - stock.maintenanceQuantity - stock.lostQuantity,
  )
}

export function toCalendarDate(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] || String(value).slice(0, 10)
}

export function dateHasBooking(bookedQuantity: number) {
  return bookedQuantity > 0
}

export function bookedQuantityFromRentals(
  bookings: AvailabilityBooking[],
  productUuid: string,
  startsOn: string,
  endsOn: string,
  excludeRentalUuid?: string,
): number {
  return bookings
    .filter(item => (
      item.productUuid === productUuid
      && (!excludeRentalUuid || item.rentalUuid !== excludeRentalUuid)
      && rentalOccupiesInventory(item.status)
      && datesOverlapInclusive(
        toCalendarDate(item.startsOn),
        toCalendarDate(item.endsOn),
        toCalendarDate(startsOn),
        toCalendarDate(endsOn),
      )
    ))
    .reduce((sum, item) => sum + item.quantity, 0)
}

export function eachCalendarDate(startsOn: string, endsOn: string): string[] {
  const days = inclusiveDayCount(startsOn, endsOn)
  const [year, month, day] = startsOn.split('-').map(Number)
  return Array.from({ length: days }, (_, index) => {
    return new Date(Date.UTC(year, month - 1, day + index)).toISOString().slice(0, 10)
  })
}

export function rangeIncludesUnavailableDates(
  startsOn: string,
  endsOn: string,
  unavailable: Iterable<string>,
) {
  if (!startsOn || !endsOn || startsOn > endsOn) {
    return false
  }

  const blocked = unavailable instanceof Set ? unavailable : new Set(unavailable)
  return eachCalendarDate(startsOn, endsOn).some(date => blocked.has(date))
}

export function rangeOverlapsBlockedDates(
  startsOn: string,
  endsOn: string,
  ranges: BlockedDateRange[],
) {
  const start = toCalendarDate(startsOn)
  const end = toCalendarDate(endsOn)

  return ranges.some((range) => {
    const blockStart = toCalendarDate(range.startsOn)
    const blockEnd = toCalendarDate(range.endsOn)
    return blockStart <= end && blockEnd >= start
  })
}

export function blockedDatesFromRanges(
  ranges: BlockedDateRange[],
  from: string,
  to: string,
): string[] {
  return eachCalendarDate(from, to).filter((date) => {
    return ranges.some((range) => {
      const start = toCalendarDate(range.startsOn)
      const end = toCalendarDate(range.endsOn)
      return date >= start && date <= end
    })
  })
}

export function mergeUnavailableDates(...lists: string[][]): string[] {
  return [...new Set(lists.flat().map(toCalendarDate))].sort()
}

export function unavailableDates(input: {
  stock: AvailabilityStock
  bookings: AvailabilityBooking[]
  productUuid: string
  requestedQuantity: number
  from: string
  to: string
}): string[] {
  return eachCalendarDate(input.from, input.to).filter((date) => {
    const bookedQuantity = bookedQuantityFromRentals(
      input.bookings,
      input.productUuid,
      date,
      date,
    )
    return dateHasBooking(bookedQuantity)
  })
}

export function evaluateAvailability(input: AvailabilityInput): AvailabilityResult {
  const capacity = rentableCapacity(input)
  const booked = Math.max(0, input.bookedQuantity)
  const available = Math.max(0, capacity - booked)
  const requested = Math.max(1, Math.trunc(input.requestedQuantity))

  return {
    capacity,
    booked,
    available,
    requested,
    canFulfill: requested <= available && booked === 0 && !input.hasBlockedDates,
  }
}
