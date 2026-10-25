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
