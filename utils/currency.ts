import { BUSINESS_CURRENCY, BUSINESS_LOCALE } from './constants'

export function formatMoney(
  amount: number,
  currency: string = BUSINESS_CURRENCY,
  locale: string = BUSINESS_LOCALE,
): string {
  if (!Number.isFinite(amount)) {
    throw new TypeError('Amount must be a finite number.')
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function toMinorUnits(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new TypeError('Amount must be a finite number.')
  }

  return Math.round(amount * 100)
}

export function fromMinorUnits(minorUnits: number): number {
  if (!Number.isInteger(minorUnits)) {
    throw new TypeError('Minor units must be an integer.')
  }

  return minorUnits / 100
}
