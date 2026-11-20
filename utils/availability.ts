import type { RentalStatus } from './constants'
import { inclusiveDayCount } from './datetime'
import { addCalendarDays } from './expense'
import { datesOverlapInclusive, rentalOccupiesInventory } from './rental-status'
import {
  DEFAULT_PICKUP_TIME,
  calendarDayOverlapsWindow,
  isPastBusinessDateTime,
  pickupTimeSlots,
  resolveHourlyRentalWindow,
  resolveRentalWindow,
} from './rental-window'

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
  pickupAt?: string
  returnAt?: string
  status: RentalStatus
  rentalUuid?: string
}

export interface OccupyingWindow {
  pickupAt: string
  returnAt: string
  quantity: number
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

export function remainingUnits(capacity: number, bookedQuantity: number) {
  return Math.max(0, capacity - Math.max(0, bookedQuantity))
}

export function quantityCannotBeFulfilled(bookedQuantity: number, capacity: number, requestedQuantity: number) {
  const requested = Math.max(1, Math.trunc(requestedQuantity))
  return requested > remainingUnits(capacity, bookedQuantity)
}

export function windowsOverlap(startA: string, endA: string, startB: string, endB: string) {
  const aStart = Date.parse(startA)
  const aEnd = Date.parse(endA)
  const bStart = Date.parse(startB)
  const bEnd = Date.parse(endB)
  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) {
    return false
  }

  return aStart < bEnd && aEnd > bStart
}

export function bookedQuantityFromRentals(
  bookings: AvailabilityBooking[],
  productUuid: string,
  startsOn: string,
  endsOn: string,
  excludeRentalUuid?: string,
  occupyWindow?: { pickupAt: string, returnAt: string },
): number {
  return bookings
    .filter((item) => {
      if (item.productUuid !== productUuid) {
        return false
      }
      if (excludeRentalUuid && item.rentalUuid === excludeRentalUuid) {
        return false
      }
      if (!rentalOccupiesInventory(item.status)) {
        return false
      }
      if (occupyWindow && item.pickupAt && item.returnAt) {
        return windowsOverlap(occupyWindow.pickupAt, occupyWindow.returnAt, item.pickupAt, item.returnAt)
      }
      return datesOverlapInclusive(
        toCalendarDate(item.startsOn),
        toCalendarDate(item.endsOn),
        toCalendarDate(startsOn),
        toCalendarDate(endsOn),
      )
    })
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

export function datesWithBookings(input: {
  bookings: AvailabilityBooking[]
  productUuid: string
  from: string
  to: string
}): string[] {
  const relevant = input.bookings.filter(item => (
    item.productUuid === input.productUuid && rentalOccupiesInventory(item.status)
  ))

  return eachCalendarDate(input.from, input.to).filter((date) => {
    return relevant.some((item) => {
      if (item.pickupAt && item.returnAt) {
        return calendarDayOverlapsWindow(date, item.pickupAt, item.returnAt)
      }

      return datesOverlapInclusive(
        toCalendarDate(item.startsOn),
        toCalendarDate(item.endsOn),
        date,
        date,
      )
    })
  })
}

export function unavailableDates(input: {
  stock: AvailabilityStock
  bookings: AvailabilityBooking[]
  productUuid: string
  requestedQuantity: number
  from: string
  to: string
}): string[] {
  const timed = input.bookings.some(item => item.productUuid === input.productUuid && item.pickupAt && item.returnAt)

  const capacity = rentableCapacity(input.stock)

  return eachCalendarDate(input.from, input.to).filter((date) => {
    if (!timed) {
      const bookedQuantity = bookedQuantityFromRentals(
        input.bookings,
        input.productUuid,
        date,
        date,
      )
      return quantityCannotBeFulfilled(bookedQuantity, capacity, input.requestedQuantity)
    }

    return pickupTimeSlots().every((time) => {
      const window = resolveRentalWindow({
        startsOn: date,
        endsOn: addCalendarDays(date, 1),
        pickupTime: time,
      })
      return quantityCannotBeFulfilled(bookedQuantityFromRentals(
        input.bookings,
        input.productUuid,
        window.startsOn,
        window.endsOn,
        undefined,
        { pickupAt: window.pickupAt, returnAt: window.returnAt },
      ), capacity, input.requestedQuantity)
    })
  })
}

export function unavailablePickupTimes(input: {
  bookings: AvailabilityBooking[]
  productUuid: string
  startsOn: string
  endsOn?: string
  hours?: number
  stock?: AvailabilityStock
  requestedQuantity?: number
}): string[] {
  if (!input.startsOn) {
    return []
  }

  const capacity = input.stock ? rentableCapacity(input.stock) : 1
  const requestedQuantity = input.requestedQuantity ?? 1

  return pickupTimeSlots().filter((time) => {
    if (isPastBusinessDateTime(input.startsOn, time)) {
      return true
    }

    const window = input.hours
      ? resolveHourlyRentalWindow({
          startsOn: input.startsOn,
          pickupTime: time,
          hours: input.hours,
        })
      : resolveRentalWindow({
          startsOn: input.startsOn,
          endsOn: input.endsOn || addCalendarDays(input.startsOn, 1),
          pickupTime: time,
        })
    return quantityCannotBeFulfilled(bookedQuantityFromRentals(
      input.bookings,
      input.productUuid,
      window.startsOn,
      window.endsOn,
      undefined,
      { pickupAt: window.pickupAt, returnAt: window.returnAt },
    ), capacity, requestedQuantity)
  })
}

export function firstOpenPickupTime(unavailable: Iterable<string>, fallback = DEFAULT_PICKUP_TIME) {
  const blocked = unavailable instanceof Set ? unavailable : new Set(unavailable)
  return pickupTimeSlots().find(time => !blocked.has(time)) || fallback
}

export function selectablePickupTime(current: string | undefined, unavailable: Iterable<string>) {
  const blocked = unavailable instanceof Set ? unavailable : new Set(unavailable)
  const slots = pickupTimeSlots()
  const normalized = current && slots.includes(current) ? current : DEFAULT_PICKUP_TIME
  return blocked.has(normalized) ? firstOpenPickupTime(blocked, normalized) : normalized
}

export function bookingsFromOccupyingWindows(
  productUuid: string,
  windows: OccupyingWindow[],
): AvailabilityBooking[] {
  return windows.map(window => ({
    productUuid,
    quantity: window.quantity,
    startsOn: toCalendarDate(window.pickupAt),
    endsOn: toCalendarDate(window.returnAt),
    pickupAt: window.pickupAt,
    returnAt: window.returnAt,
    status: 'approved',
  }))
}

/** Pickup first, then a later return day. A return on the pickup day is not a finished range. */
export function nextBookingRange(
  current: { startsOn: string, endsOn: string },
  picked: { start: string, end?: string },
  options: { min?: string, closed?: Iterable<string>, flexible?: boolean } = {},
) {
  const min = options.min || ''
  const closed = options.closed instanceof Set ? options.closed : new Set(options.closed ?? [])
  const flexible = options.flexible ?? false
  const keptReturn = current.endsOn > picked.start ? current.endsOn : ''

  if (!picked.start || (min && picked.start < min) || (!flexible && closed.has(picked.start))) {
    return { startsOn: current.startsOn, endsOn: current.endsOn, complete: false, error: 'closed' as const }
  }

  const end = picked.end || ''
  if (!end || end <= picked.start) {
    return {
      startsOn: picked.start,
      endsOn: keptReturn,
      complete: false,
      error: end ? 'order' as const : '' as const,
    }
  }

  if (!flexible && (closed.has(end) || rangeIncludesUnavailableDates(picked.start, end, closed))) {
    return { startsOn: picked.start, endsOn: keptReturn, complete: false, error: 'blocked' as const }
  }

  return { startsOn: picked.start, endsOn: end, complete: true, error: '' as const }
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
    canFulfill: requested <= available && !input.hasBlockedDates,
  }
}
