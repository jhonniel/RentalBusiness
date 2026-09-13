import { fromMinorUnits, toMinorUnits } from './currency'

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
}) {
  const quantity = Math.max(1, Math.trunc(input.quantity))
  const days = Math.max(1, Math.trunc(input.days))
  let best = input.dailyPrice * days

  if (input.weeklyPrice !== null && days >= 7) {
    const weeks = Math.floor(days / 7)
    const remainder = days % 7
    best = Math.min(best, weeks * input.weeklyPrice + remainder * input.dailyPrice)
  }

  if (input.monthlyPrice !== null && days >= 28) {
    const months = Math.floor(days / 28)
    const remainder = days % 28
    const remainderCost = input.weeklyPrice !== null && remainder >= 7
      ? Math.floor(remainder / 7) * input.weeklyPrice + (remainder % 7) * input.dailyPrice
      : remainder * input.dailyPrice
    best = Math.min(best, months * input.monthlyPrice + remainderCost)
  }

  return {
    days,
    quantity,
    dailyPrice: input.dailyPrice,
    lineTotal: fromMinorUnits(toMinorUnits(best * quantity)),
    depositAmount: fromMinorUnits(toMinorUnits(input.depositAmount * quantity)),
  }
}
