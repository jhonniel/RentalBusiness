import { describe, expect, it } from 'vitest'
import { adminCalendarQuerySchema } from '../../utils/admin-validation'
import {
  calendarAgenda,
  eventCoversDate,
  eventsOnDate,
  monthBounds,
  monthCells,
  monthKey,
  shiftMonth,
} from '../../utils/calendar'

describe('admin calendar', () => {
  it('builds Manila month bounds and Sunday-start cells', () => {
    expect(monthKey('2026-09-13')).toBe('2026-09')
    expect(monthBounds('2026-09')).toEqual({
      startsOn: '2026-09-01',
      endsOn: '2026-09-30',
    })
    expect(monthBounds('2026-02')).toEqual({
      startsOn: '2026-02-01',
      endsOn: '2026-02-28',
    })
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')

    const cells = monthCells('2026-09')
    expect(cells[0]).toBeNull()
    expect(cells[2]).toBe('2026-09-01')
    expect(cells.filter(Boolean)).toHaveLength(30)
    expect(cells.length % 7).toBe(0)
  })

  it('places inclusive rental ranges on overlapping days only', () => {
    const items = [
      {
        uuid: 'a',
        code: 'RNT-1',
        status: 'approved' as const,
        startsOn: '2026-09-10',
        endsOn: '2026-09-12',
        productName: 'DJI Air 3',
        customerName: 'Ana Reyes',
      },
    ]

    expect(eventCoversDate(items[0], '2026-09-10')).toBe(true)
    expect(eventCoversDate(items[0], '2026-09-12')).toBe(true)
    expect(eventCoversDate(items[0], '2026-09-13')).toBe(false)
    expect(eventsOnDate(items, '2026-09-11')).toHaveLength(1)
    expect(calendarAgenda(items, '2026-09').map(day => day.date)).toEqual([
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
    ])
  })

  it('accepts a month query and rejects an invalid month', () => {
    expect(adminCalendarQuerySchema.parse({ month: '2026-09' })).toEqual({ month: '2026-09' })
    expect(adminCalendarQuerySchema.safeParse({ month: '2026-9' }).success).toBe(false)
  })
})
