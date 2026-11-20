import { fromMinorUnits, toMinorUnits } from './currency'

export const LONG_STAY_LESS_DAYS = 3

export function inclusiveRentalDays(startsOn: string, endsOn: string): number {
  if (startsOn > endsOn) {
    throw new TypeError('End date must be on or after the start date.')
  }

  const start = Date.parse(`${startsOn}T00:00:00.000Z`)
  const end = Date.parse(`${endsOn}T00:00:00.000Z`)

  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new TypeError('Invalid rental dates.')
  }

  return Math.round((end - start) / 86_400_000) + 1
}

export function quoteRentalLine(input: {
  dailyPrice: number
  weeklyPrice: number | null
  monthlyPrice: number | null
  depositAmount: number
  quantity: number
  days: number
  longStayLess?: number
  longStayMinDays?: number
}) {
  const quantity = Math.max(1, Math.trunc(input.quantity))
  const days = Math.max(1, Math.trunc(input.days))
  // Weekly and monthly prices are shown on the catalog only; rent is always the daily price per day.
  const rentAmount = fromMinorUnits(toMinorUnits(input.dailyPrice * days * quantity))
  const lessPerDay = Math.max(0, input.longStayLess ?? 0)
  const minDays = Math.max(1, Math.trunc(input.longStayMinDays ?? LONG_STAY_LESS_DAYS))
  const lessAmount = lessPerDay > 0 && days >= minDays
    ? fromMinorUnits(toMinorUnits(lessPerDay * days * quantity))
    : 0

  return {
    days,
    quantity,
    dailyPrice: input.dailyPrice,
    rentAmount,
    lessAmount,
    lineTotal: fromMinorUnits(toMinorUnits(Math.max(0, rentAmount - lessAmount))),
    depositAmount: fromMinorUnits(toMinorUnits(input.depositAmount * quantity)),
  }
}

export const HOURLY_DISCOUNTS = ['none', 'per_hour', 'hours'] as const
export type HourlyDiscount = typeof HOURLY_DISCOUNTS[number]

export function hourlyDiscountKind(value: unknown): HourlyDiscount {
  return value === 'per_hour' || value === 'hours' ? value : 'none'
}

/** Peso taken off an hourly booking. Daily long-stay less does not apply here. */
export function hourlyLessAmount(input: {
  hourlyPrice: number
  hours: number
  quantity: number
  hourlyDiscount?: HourlyDiscount | null
  hourlyLess?: number
  hourlyLessHours?: number
  hourlyLessMinHours?: number
}) {
  const quantity = Math.max(1, Math.trunc(input.quantity))
  const hours = Math.max(1, Math.trunc(input.hours))
  const hourlyPrice = fromMinorUnits(toMinorUnits(input.hourlyPrice))
  const rentAmount = fromMinorUnits(toMinorUnits(hourlyPrice * hours * quantity))
  const minHours = Math.min(24, Math.max(1, Math.trunc(input.hourlyLessMinHours ?? 1)))
  if (hours < minHours) {
    return 0
  }

  const kind = hourlyDiscountKind(input.hourlyDiscount)
  const less = kind === 'per_hour'
    ? fromMinorUnits(toMinorUnits(Math.max(0, input.hourlyLess ?? 0) * hours * quantity))
    : kind === 'hours'
      ? fromMinorUnits(toMinorUnits(hourlyPrice * Math.min(hours, Math.max(0, Math.trunc(input.hourlyLessHours ?? 0))) * quantity))
      : 0

  return Math.min(rentAmount, less)
}

export function hourlyDiscountNote(input: {
  hourlyDiscount?: HourlyDiscount | null
  hourlyLess?: number
  hourlyLessHours?: number
  hourlyLessMinHours?: number
}, format: (amount: number) => string) {
  const kind = hourlyDiscountKind(input.hourlyDiscount)
  const minHours = Math.min(24, Math.max(1, Math.trunc(input.hourlyLessMinHours ?? 1)))
  const from = `from ${minHours} hour${minHours === 1 ? '' : 's'}`
  if (kind === 'per_hour' && (input.hourlyLess ?? 0) > 0) {
    return `${format(input.hourlyLess ?? 0)} off each hour ${from}.`
  }
  if (kind === 'hours' && (input.hourlyLessHours ?? 0) > 0) {
    const hoursOff = Math.trunc(input.hourlyLessHours ?? 0)
    return `${hoursOff} hour${hoursOff === 1 ? '' : 's'} off ${from}.`
  }
  return ''
}

/** Rent is the admin hourly rate times the hours and the quantity, less the hourly discount when the booking reaches its minimum hours. */
export function quoteHourlyRentalLine(input: {
  hourlyPrice: number
  depositAmount: number
  quantity: number
  hours: number
  hourlyDiscount?: HourlyDiscount | null
  hourlyLess?: number
  hourlyLessHours?: number
  hourlyLessMinHours?: number
}) {
  const quantity = Math.max(1, Math.trunc(input.quantity))
  const hours = Math.max(1, Math.trunc(input.hours))
  const hourlyPrice = fromMinorUnits(toMinorUnits(input.hourlyPrice))
  const rentAmount = fromMinorUnits(toMinorUnits(hourlyPrice * hours * quantity))
  const lessAmount = hourlyLessAmount(input)

  return {
    hours,
    quantity,
    hourlyPrice,
    rentAmount,
    lessAmount,
    lineTotal: fromMinorUnits(toMinorUnits(Math.max(0, rentAmount - lessAmount))),
    depositAmount: fromMinorUnits(toMinorUnits(input.depositAmount * quantity)),
  }
}

export function quoteExtensionLine(input: {
  dailyPrice: number
  weeklyPrice: number | null
  monthlyPrice: number | null
  quantity: number
  extensionDays: number
  longStayLess?: number
  longStayMinDays?: number
}) {
  const line = quoteRentalLine({
    ...input,
    depositAmount: 0,
    days: input.extensionDays,
  })
  return {
    days: line.days,
    rentAmount: line.rentAmount,
    lessAmount: line.lessAmount,
    lineTotal: line.lineTotal,
  }
}

export function addMoney(...values: number[]) {
  return fromMinorUnits(values.reduce((sum, value) => sum + toMinorUnits(value), 0))
}
