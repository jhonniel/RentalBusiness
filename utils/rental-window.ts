import { BUSINESS_TIMEZONE } from './constants'
import { calendarDateInZone, inclusiveDayCount, isPastBusinessDate, toDate } from './datetime'
import { addCalendarDays } from './expense'

export const DEFAULT_PICKUP_TIME = '09:00'
export const PICKUP_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function isPickupTime(value: string): boolean {
  return PICKUP_TIME_RE.test(value)
}

export function isShopPickupTime(value: string) {
  return pickupTimeSlots().includes(value)
}

export function normalizePickupTime(value?: string | null) {
  return value && isShopPickupTime(value) ? value : DEFAULT_PICKUP_TIME
}

export function pickupTimeSlots(fromHour = 8, toHour = 20, stepMinutes = 30): string[] {
  const slots: string[] = []
  for (let minutes = fromHour * 60; minutes <= toHour * 60; minutes += stepMinutes) {
    const hour = Math.floor(minutes / 60)
    const minute = minutes % 60
    slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
  }
  return slots
}

export function formatPickupClock(time: string): string {
  const [hourRaw, minute = '00'] = time.split(':')
  const hour = Number(hourRaw)
  if (Number.isNaN(hour)) {
    return time
  }

  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:${minute} ${suffix}`
}

export function businessDateTimeToUtc(date: string, time: string): string {
  if (!isPickupTime(time)) {
    throw new TypeError('Choose a pickup time.')
  }

  return new Date(`${date}T${time}:00+08:00`).toISOString()
}

export function pickupTimeFromInstant(value: string | Date, timeZone: string = BUSINESS_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(toDate(value))
  const hour = parts.find(part => part.type === 'hour')?.value || '00'
  const minute = parts.find(part => part.type === 'minute')?.value || '00'
  return `${hour}:${minute}`
}

export function isPastBusinessDateTime(
  date: string,
  time: string,
  now: Date = new Date(),
): boolean {
  if (isPastBusinessDate(date, calendarDateInZone(now))) {
    return true
  }

  if (date > calendarDateInZone(now)) {
    return false
  }

  return businessDateTimeToUtc(date, time) <= now.toISOString()
}

export function rentalPeriodDays(startsOn: string, returnOn: string): number {
  const inclusive = inclusiveDayCount(startsOn, returnOn)
  return startsOn === returnOn ? Math.max(1, inclusive) : Math.max(1, inclusive - 1)
}

export function resolveRentalWindow(input: {
  startsOn: string
  endsOn: string
  pickupTime: string
}) {
  const pickupTime = isPickupTime(input.pickupTime) ? input.pickupTime : DEFAULT_PICKUP_TIME
  const endsOn = input.endsOn <= input.startsOn ? addCalendarDays(input.startsOn, 1) : input.endsOn

  return {
    startsOn: input.startsOn,
    endsOn,
    days: rentalPeriodDays(input.startsOn, endsOn),
    pickupTime,
    pickupAt: businessDateTimeToUtc(input.startsOn, pickupTime),
    returnAt: businessDateTimeToUtc(endsOn, pickupTime),
  }
}

export function defaultRentalReturnOn(startsOn: string, days = 1): string {
  return addCalendarDays(startsOn, Math.max(1, days))
}

export function calendarDayOverlapsWindow(date: string, pickupAt: string, returnAt: string) {
  const dayStart = businessDateTimeToUtc(date, '00:00')
  const dayEnd = businessDateTimeToUtc(addCalendarDays(date, 1), '00:00')
  return pickupAt < dayEnd && returnAt > dayStart
}

export function formatRentalReturnLabel(endsOn: string, pickupTime: string): string {
  const [year, month, day] = endsOn.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  if (!year || !month || !day) {
    return `${endsOn} at ${formatPickupClock(pickupTime)}`
  }

  return `${day} ${months[month - 1]} ${year} at ${formatPickupClock(pickupTime)}`
}
