import { describe, expect, it } from 'vitest'
import { nextBookingRange } from '../../utils/availability'

describe('nextBookingRange', () => {
  it('keeps the pickup until a later return day is chosen', () => {
    expect(nextBookingRange(
      { startsOn: '2026-11-19', endsOn: '2026-11-20' },
      { start: '2026-11-21' },
    )).toMatchObject({
      startsOn: '2026-11-21',
      endsOn: '',
      complete: false,
    })
  })

  it('saves both days from one range', () => {
    expect(nextBookingRange(
      { startsOn: '2026-11-19', endsOn: '2026-11-20' },
      { start: '2026-11-21', end: '2026-11-23' },
    )).toEqual({
      startsOn: '2026-11-21',
      endsOn: '2026-11-23',
      complete: true,
      error: '',
    })
  })

  it('asks for a return day after the pickup day', () => {
    expect(nextBookingRange(
      { startsOn: '2026-11-19', endsOn: '2026-11-20' },
      { start: '2026-11-21', end: '2026-11-21' },
    ).error).toBe('order')
  })

  it('refuses a range that crosses a booked day', () => {
    expect(nextBookingRange(
      { startsOn: '2026-11-19', endsOn: '2026-11-20' },
      { start: '2026-11-21', end: '2026-11-24' },
      { closed: ['2026-11-23'] },
    )).toMatchObject({ complete: false, error: 'blocked', endsOn: '' })
  })

  it('allows booked days when the form is flexible', () => {
    expect(nextBookingRange(
      { startsOn: '2026-11-19', endsOn: '2026-11-20' },
      { start: '2026-11-21', end: '2026-11-24' },
      { closed: ['2026-11-23'], flexible: true },
    ).complete).toBe(true)
  })
})
