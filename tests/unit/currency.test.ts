import { describe, expect, it } from 'vitest'
import { formatMoney, fromMinorUnits, toMinorUnits } from '../../utils/currency'

describe('formatMoney', () => {
  it('formats PHP using the business locale', () => {
    expect(formatMoney(125500)).toContain('125,500.00')
  })

  it('rejects non-finite amounts', () => {
    expect(() => formatMoney(Number.NaN)).toThrow(TypeError)
  })
})

describe('minor units', () => {
  it('round-trips pesos to centavos', () => {
    expect(toMinorUnits(84.5)).toBe(8450)
    expect(fromMinorUnits(8450)).toBe(84.5)
  })
})
