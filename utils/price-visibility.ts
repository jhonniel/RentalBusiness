import type { CatalogProduct } from '~/types/catalog'
import { PRICE_FIELD_KEYS, type PriceFieldKey } from './constants'

const PRICE_FIELD_DB: Record<PriceFieldKey, string> = {
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
  deposit: 'deposit',
  lateFee: 'late_fee',
  replacementValue: 'replacement_value',
}

const PRICE_FIELD_FROM_DB = Object.fromEntries(
  Object.entries(PRICE_FIELD_DB).map(([key, value]) => [value, key]),
) as Record<string, PriceFieldKey>

const PRICE_FIELD_LABELS: Record<PriceFieldKey, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  deposit: 'Deposit',
  lateFee: 'Late fee',
  replacementValue: 'Replacement value',
}

const CARD_RATE_SUFFIX: Partial<Record<PriceFieldKey, string>> = {
  daily: '/ day',
  weekly: '/ week',
  monthly: '/ month',
}

export function parseHiddenPriceFields(value: unknown): PriceFieldKey[] {
  if (!Array.isArray(value)) {
    return []
  }

  const hidden = new Set<PriceFieldKey>()
  for (const item of value) {
    if (typeof item !== 'string') {
      continue
    }
    if ((PRICE_FIELD_KEYS as readonly string[]).includes(item)) {
      hidden.add(item as PriceFieldKey)
      continue
    }
    const mapped = PRICE_FIELD_FROM_DB[item]
    if (mapped) {
      hidden.add(mapped)
    }
  }

  return PRICE_FIELD_KEYS.filter(key => hidden.has(key))
}

export function toHiddenPriceFieldDb(fields: readonly PriceFieldKey[]): string[] {
  return parseHiddenPriceFields(fields).map(field => PRICE_FIELD_DB[field])
}

export function isPriceFieldHidden(hidden: readonly PriceFieldKey[], field: PriceFieldKey) {
  return hidden.includes(field)
}

export function visibleCatalogPrices(product: Pick<
  CatalogProduct,
  'dailyPrice' | 'weeklyPrice' | 'monthlyPrice' | 'depositAmount' | 'lateFee' | 'replacementValue'
>): Array<{ key: PriceFieldKey, label: string, amount: number }> {
  const amounts: Record<PriceFieldKey, number | null> = {
    daily: product.dailyPrice,
    weekly: product.weeklyPrice,
    monthly: product.monthlyPrice,
    deposit: product.depositAmount,
    lateFee: product.lateFee,
    replacementValue: product.replacementValue,
  }

  return PRICE_FIELD_KEYS.flatMap((key) => {
    const amount = amounts[key]
    return amount === null
      ? []
      : [{ key, label: PRICE_FIELD_LABELS[key], amount }]
  })
}

export function catalogCardRate(product: Pick<CatalogProduct, 'dailyPrice' | 'weeklyPrice' | 'monthlyPrice'>) {
  const rates: Array<[PriceFieldKey, number | null]> = [
    ['daily', product.dailyPrice],
    ['weekly', product.weeklyPrice],
    ['monthly', product.monthlyPrice],
  ]

  for (const [key, amount] of rates) {
    if (amount === null) {
      continue
    }
    return {
      amount,
      suffix: CARD_RATE_SUFFIX[key] || '',
    }
  }

  return null
}
