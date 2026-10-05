import { describe, expect, it } from 'vitest'
import {
  businessDateTimeToUtc,
  calendarDayOverlapsWindow,
  formatPickupClock,
  formatRentalReturnLabel,
  isPastBusinessDateTime,
  normalizePickupTime,
  rentalPeriodDays,
  resolveRentalWindow,
} from '../../utils/rental-window'

describe('rental pickup and return window', () => {
  it('returns the kit at the same clock time on the last day', () => {
    const window = resolveRentalWindow({
      startsOn: '2026-10-05',
      endsOn: '2026-10-10',
      pickupTime: '13:00',
    })

    expect(window.days).toBe(5)
    expect(window.pickupAt).toBe('2026-10-05T05:00:00.000Z')
    expect(window.returnAt).toBe('2026-10-10T05:00:00.000Z')
    expect(formatRentalReturnLabel(window.endsOn, window.pickupTime)).toBe('10 Oct 2026 at 1:00 PM')
    expect(formatPickupClock('13:00')).toBe('1:00 PM')
  })

  it('treats a same-day booking as one 24-hour rental', () => {
    const window = resolveRentalWindow({
      startsOn: '2026-10-05',
      endsOn: '2026-10-05',
      pickupTime: '13:00',
    })

    expect(window.endsOn).toBe('2026-10-06')
    expect(window.days).toBe(1)
    expect(rentalPeriodDays('2026-10-05', '2026-10-06')).toBe(1)
    expect(businessDateTimeToUtc('2026-10-05', '13:00')).toBe('2026-10-05T05:00:00.000Z')
    expect(calendarDayOverlapsWindow('2026-10-05', window.pickupAt, window.returnAt)).toBe(true)
    expect(calendarDayOverlapsWindow('2026-10-06', window.pickupAt, window.returnAt)).toBe(true)
    expect(calendarDayOverlapsWindow('2026-10-07', window.pickupAt, window.returnAt)).toBe(false)
  })

  it('rejects a pickup time that has already passed today', () => {
    expect(isPastBusinessDateTime('2026-10-05', '13:00', new Date('2026-10-05T06:00:00.000Z'))).toBe(true)
    expect(isPastBusinessDateTime('2026-10-05', '13:00', new Date('2026-10-05T04:00:00.000Z'))).toBe(false)
    expect(isPastBusinessDateTime('2026-10-06', '09:00', new Date('2026-10-05T20:00:00.000Z'))).toBe(false)
  })

  it('maps midnight backfills to the default shop pickup slot', () => {
    expect(normalizePickupTime('00:00')).toBe('09:00')
    expect(normalizePickupTime('13:00')).toBe('13:00')
  })
})
