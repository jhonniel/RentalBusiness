import { describe, expect, it } from 'vitest'
import { adminCalendarFindQuerySchema, adminCalendarQuerySchema } from '../../utils/admin-validation'
import {
  applyCalendarPick,
  blocksOnDate,
  bookingColor,
  CALENDAR_BOOKING_COLORS,
  calendarAgenda,
  calendarWeekBars,
  calendarWeeks,
  eventCoversDate,
  eventsOnDate,
  isDateInRange,
  isExtensionDay,
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

  it('marks pickup and return calendar days when a timed window spans midnight', () => {
    const items = [
      {
        uuid: 'a',
        code: 'JRY-20261005-00011',
        status: 'draft' as const,
        startsOn: '2026-10-05',
        endsOn: '2026-10-05',
        pickupAt: '2026-10-05T01:00:00.000Z',
        returnAt: '2026-10-06T01:00:00.000Z',
        productName: 'Starlink Mini',
        customerName: 'Kimberly Monta',
      },
    ]

    expect(eventCoversDate(items[0], '2026-10-05')).toBe(true)
    expect(eventCoversDate(items[0], '2026-10-06')).toBe(true)
    expect(eventCoversDate(items[0], '2026-10-07')).toBe(false)
  })

  it('lets an admin pick a day or a range and shows blocked kits on those days', () => {
    expect(applyCalendarPick('2026-09-22', '', '', '2026-09-22')).toEqual({
      startsOn: '2026-09-22',
      endsOn: '2026-09-22',
    })
    expect(applyCalendarPick('2026-09-24', '2026-09-22', '2026-09-22', '2026-09-22')).toEqual({
      startsOn: '2026-09-22',
      endsOn: '2026-09-24',
    })
    expect(applyCalendarPick('2026-09-20', '2026-09-22', '2026-09-22', '2026-09-22')).toEqual({
      startsOn: '2026-09-22',
      endsOn: '2026-09-22',
    })
    expect(applyCalendarPick('2026-09-21', '', '', '2026-09-22')).toEqual({
      startsOn: '',
      endsOn: '',
    })
    expect(isDateInRange('2026-09-23', '2026-09-22', '2026-09-24')).toBe(true)

    const blocks = [{
      uuid: 'block-1',
      startsOn: '2026-09-18',
      endsOn: '2026-09-18',
      reason: 'Holiday',
      productUuid: 'p1',
      productName: 'Starlink Mini',
    }]

    expect(blocksOnDate(blocks, '2026-09-18')).toHaveLength(1)
    expect(calendarAgenda([], '2026-09', blocks).map(day => day.date)).toEqual(['2026-09-18'])
  })

  it('accepts a month query and rejects an invalid month', () => {
    expect(adminCalendarQuerySchema.parse({ month: '2026-09' })).toEqual({ month: '2026-09' })
    expect(adminCalendarQuerySchema.safeParse({ month: '2026-9' }).success).toBe(false)
  })

  it('accepts a booking ID search and rejects anything else', () => {
    expect(adminCalendarFindQuerySchema.parse({ code: ' jry-20261013-00024 ' })).toEqual({ code: 'JRY-20261013-00024' })
    expect(adminCalendarFindQuerySchema.safeParse({ code: 'JR' }).success).toBe(false)
    expect(adminCalendarFindQuerySchema.safeParse({ code: 'JRY,code.eq.1' }).success).toBe(false)
  })

  it('draws one bar per week for each booking and stacks overlaps in lanes', () => {
    const weeks = calendarWeeks('2026-10')
    expect(weeks).toHaveLength(5)
    expect(weeks[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03'])

    const rentals = [
      { key: 'a', startsOn: '2026-10-02', endsOn: '2026-10-06' },
      { key: 'b', startsOn: '2026-10-03', endsOn: '2026-10-03' },
      { key: 'c', startsOn: '2026-10-05', endsOn: '2026-10-05' },
    ]

    const first = calendarWeekBars(rentals, weeks[0]!)
    expect(first.lanes).toBe(2)
    expect(first.bars.map(bar => [bar.entry.key, bar.column, bar.span, bar.lane, bar.continuesBefore, bar.continuesAfter])).toEqual([
      ['a', 6, 2, 0, false, true],
      ['b', 7, 1, 1, false, false],
    ])

    const second = calendarWeekBars(rentals, weeks[1]!)
    expect(second.lanes).toBe(2)
    expect(second.bars.map(bar => [bar.entry.key, bar.column, bar.span, bar.lane, bar.continuesBefore, bar.continuesAfter])).toEqual([
      ['a', 1, 3, 0, true, false],
      ['c', 2, 1, 1, false, false],
    ])
  })

  it('marks the extension part of a bar after the first booking ends', () => {
    const weeks = calendarWeeks('2026-10')
    const extended = [{ key: 'a', startsOn: '2026-10-21', endsOn: '2026-10-26', originalEndsOn: '2026-10-24' }]

    const fourth = calendarWeekBars(extended, weeks[3]!)
    expect(fourth.bars[0]).toMatchObject({ column: 4, span: 4, extensionFrom: null })

    const fifth = calendarWeekBars(extended, weeks[4]!)
    expect(fifth.bars[0]).toMatchObject({ column: 1, span: 2, extensionFrom: 0 })

    const midWeek = [{ key: 'b', startsOn: '2026-10-05', endsOn: '2026-10-09', originalEndsOn: '2026-10-07' }]
    expect(calendarWeekBars(midWeek, weeks[1]!).bars[0]).toMatchObject({ column: 2, span: 5, extensionFrom: 3 })

    expect(isExtensionDay(extended[0]!, '2026-10-24')).toBe(false)
    expect(isExtensionDay(extended[0]!, '2026-10-25')).toBe(true)
    expect(isExtensionDay({ originalEndsOn: null }, '2026-10-25')).toBe(false)
  })

  it('gives the same booking ID the same color every time', () => {
    expect(bookingColor('JRY-20261013-00024')).toBe(bookingColor('JRY-20261013-00024'))
    expect(CALENDAR_BOOKING_COLORS).toContain(bookingColor('JRY-20261015-00026'))
  })
})
