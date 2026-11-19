export interface CountedAmount {
  prefix: string
  suffix: string
  number: number
  decimals: number
}

/** Splits a formatted amount such as `₱1,800.00` into the number and the text around it. */
export function splitCountedAmount(value: string): CountedAmount | null {
  const match = value.match(/^(.*?)(-?\d[\d,]*(?:\.\d+)?)(.*)$/)
  if (!match) {
    return null
  }

  const raw = match[2]!.replaceAll(',', '')
  const number = Number(raw)
  if (!Number.isFinite(number)) {
    return null
  }

  return {
    prefix: match[1] ?? '',
    suffix: match[3] ?? '',
    number,
    decimals: raw.includes('.') ? raw.split('.')[1]!.length : 0,
  }
}

/** Hides an amount with one asterisk per digit. `₱10,500.00` becomes `₱*******`. */
export function maskCountedAmount(value: string): string {
  return value.replace(/\d/g, '*').replace(/[.,]/g, '')
}

export function formatCountedAmount(amount: CountedAmount, current: number): string {
  const formatted = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: amount.decimals,
    maximumFractionDigits: amount.decimals,
  }).format(current)
  return `${amount.prefix}${formatted}${amount.suffix}`
}
