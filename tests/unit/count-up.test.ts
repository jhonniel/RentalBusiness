import { describe, expect, it } from 'vitest'
import { formatCountedAmount, maskCountedAmount, splitCountedAmount } from '../../utils/count-up'

describe('counted amounts', () => {
  it('keeps the currency around a peso amount', () => {
    const amount = splitCountedAmount('₱1,800.00')
    expect(amount).toEqual({ prefix: '₱', suffix: '', number: 1800, decimals: 2 })
    expect(amount && formatCountedAmount(amount, 900)).toBe('₱900.00')
  })

  it('counts plain numbers and leaves text without a number alone', () => {
    expect(splitCountedAmount('12')).toMatchObject({ number: 12, decimals: 0, prefix: '', suffix: '' })
    expect(splitCountedAmount('—')).toBeNull()
    expect(splitCountedAmount('-₱1,500.50')).toMatchObject({ prefix: '-₱', number: 1500.5, decimals: 2 })
  })

  it('masks each digit and keeps the currency and separators', () => {
    expect(maskCountedAmount('₱10,500.00')).toBe('₱**,***.**')
    expect(maskCountedAmount('-₱109,427.09')).toBe('-₱***,***.**')
    expect(maskCountedAmount('₱2.5K')).toBe('₱*.*K')
    expect(maskCountedAmount('—')).toBe('—')
  })
})
