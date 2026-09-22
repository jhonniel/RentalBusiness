import { describe, expect, it } from 'vitest'
import { calendarDateInZone, formatBookingDate, formatBusinessDate, isInclusiveDateRange, isPastBusinessDate, isStartBeforeEnd } from '../../utils/datetime'

describe('formatBookingDate', () => {
  it('keeps spaces between day, month, and year', () => {
    expect(formatBookingDate('2026-09-13')).toBe('13 Sep 2026')
  })
})

describe('formatBusinessDate', () => {
  it('formats a UTC instant in Asia/Manila', () => {
    const formatted = formatBusinessDate('2026-01-15T16:00:00.000Z')
    expect(formatted).toContain('2026')
    expect(formatted.toLowerCase()).toContain('jan')
  })
})

describe('isStartBeforeEnd', () => {
  it('requires the start instant to be earlier than the end', () => {
    expect(isStartBeforeEnd('2026-09-11', '2026-09-13')).toBe(true)
    expect(isStartBeforeEnd('2026-09-13', '2026-09-11')).toBe(false)
  })
})

describe('inclusive rental dates', () => {
  it('allows a same-day range and formats Manila calendar dates', () => {
    expect(isInclusiveDateRange('2026-09-12', '2026-09-12')).toBe(true)
    expect(isInclusiveDateRange('2026-09-13', '2026-09-12')).toBe(false)
    expect(calendarDateInZone('2026-01-15T16:00:00.000Z')).toBe('2026-01-16')
    expect(isPastBusinessDate('2026-09-21', '2026-09-22')).toBe(true)
    expect(isPastBusinessDate('2026-09-22', '2026-09-22')).toBe(false)
  })
})
