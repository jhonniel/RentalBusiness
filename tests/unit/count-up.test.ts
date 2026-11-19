import { describe, expect, it } from 'vitest'
import { formatCountedAmount, splitCountedAmount } from '../../utils/count-up'

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
})
