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
      && datesOverlapInclusive(item.startsOn, item.endsOn, startsOn, endsOn)
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
    return !evaluateAvailability({
      ...input.stock,
      bookedQuantity,
      requestedQuantity: input.requestedQuantity,
    }).canFulfill
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
    canFulfill: requested <= available,
  }
}
