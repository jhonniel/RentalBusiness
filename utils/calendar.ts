import type { PublicBlockedDate } from '~/types/availability'
import type { AdminCalendarEvent } from '~/types/calendar'
import { calendarDateInZone } from './datetime'
import { addCalendarDays } from './expense'
import { calendarDayOverlapsWindow } from './rental-window'

export function monthKey(value: string = calendarDateInZone()) {
  return value.slice(0, 7)
}

export function monthBounds(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return {
    startsOn: `${month}-01`,
    endsOn: `${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthCells(month: string) {
  const { startsOn, endsOn } = monthBounds(month)
  const pad = new Date(`${startsOn}T00:00:00Z`).getUTCDay()
  const days = Number(endsOn.slice(8))
  const cells: Array<string | null> = Array.from({ length: pad }, () => null)

  for (let day = 1; day <= days; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, '0')}`)
  }

  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  return cells
}

export function eventCoversDate(event: Pick<AdminCalendarEvent, 'startsOn' | 'endsOn' | 'pickupAt' | 'returnAt'>, date: string) {
  if (event.pickupAt && event.returnAt) {
    return calendarDayOverlapsWindow(date, event.pickupAt, event.returnAt)
  }

  return event.startsOn <= date && date <= event.endsOn
}

export function eventsOnDate(items: AdminCalendarEvent[], date: string) {
  return items.filter(item => eventCoversDate(item, date))
}

export function blocksOnDate(blocks: PublicBlockedDate[], date: string) {
  return blocks.filter(block => eventCoversDate(block, date))
}

export function applyCalendarPick(
  date: string,
  startsOn: string,
  endsOn: string,
  today: string = calendarDateInZone(),
) {
  if (date < today) {
    return { startsOn, endsOn }
  }

  if (!startsOn || (startsOn !== endsOn && endsOn)) {
    return { startsOn: date, endsOn: date }
  }

  if (date < startsOn) {
    return { startsOn: date, endsOn: startsOn }
  }

  return { startsOn, endsOn: date }
}

export function isDateInRange(date: string, startsOn?: string, endsOn?: string) {
  if (!startsOn) {
    return false
  }

  const start = startsOn <= (endsOn || startsOn) ? startsOn : (endsOn || startsOn)
  const end = startsOn <= (endsOn || startsOn) ? (endsOn || startsOn) : startsOn
  return start <= date && date <= end
}

export function calendarWeeks(month: string) {
  const cells = monthCells(month)
  const weeks: Array<Array<string | null>> = []
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7))
  }
  return weeks
}

type CalendarSpan = Pick<AdminCalendarEvent, 'startsOn' | 'endsOn' | 'pickupAt' | 'returnAt' | 'originalEndsOn'>

export interface CalendarWeekBar<T> {
  entry: T
  column: number
  span: number
  lane: number
  continuesBefore: boolean
  continuesAfter: boolean
  extensionFrom: number | null
}

export function isExtensionDay(entry: Pick<AdminCalendarEvent, 'originalEndsOn'>, date: string) {
  return Boolean(entry.originalEndsOn) && date > entry.originalEndsOn!
}

export function calendarWeekBars<T extends CalendarSpan>(entries: T[], week: Array<string | null>) {
  const bars: CalendarWeekBar<T>[] = []

  for (const entry of entries) {
    const covered = week
      .map((date, index) => (date && eventCoversDate(entry, date) ? index : -1))
      .filter(index => index >= 0)
    if (!covered.length) {
      continue
    }

    const first = covered[0]!
    const last = covered[covered.length - 1]!
    const firstDate = week[first]!
    const lastDate = week[last]!
    const extensionIndex = covered.find(index => isExtensionDay(entry, week[index]!))
    bars.push({
      entry,
      column: first + 1,
      span: last - first + 1,
      lane: 0,
      continuesBefore: entryStartsBefore(entry, firstDate),
      continuesAfter: entryEndsAfter(entry, lastDate),
      extensionFrom: extensionIndex === undefined ? null : extensionIndex - first,
    })
  }

  bars.sort((a, b) => a.column - b.column || b.span - a.span)
  const laneEnds: number[] = []
  for (const bar of bars) {
    const lane = laneEnds.findIndex(end => end < bar.column)
    bar.lane = lane === -1 ? laneEnds.length : lane
    laneEnds[bar.lane] = bar.column + bar.span - 1
  }

  return { bars, lanes: laneEnds.length }
}

function entryStartsBefore(entry: CalendarSpan, date: string) {
  return eventCoversDate(entry, addCalendarDays(date, -1))
}

function entryEndsAfter(entry: CalendarSpan, date: string) {
  return eventCoversDate(entry, addCalendarDays(date, 1))
}

export const CALENDAR_BOOKING_COLORS = [
  { bar: 'bg-sky-100 text-sky-950 ring-sky-300', dot: 'bg-sky-500' },
  { bar: 'bg-emerald-100 text-emerald-950 ring-emerald-300', dot: 'bg-emerald-500' },
  { bar: 'bg-amber-100 text-amber-950 ring-amber-300', dot: 'bg-amber-500' },
  { bar: 'bg-rose-100 text-rose-950 ring-rose-300', dot: 'bg-rose-500' },
  { bar: 'bg-violet-100 text-violet-950 ring-violet-300', dot: 'bg-violet-500' },
  { bar: 'bg-teal-100 text-teal-950 ring-teal-300', dot: 'bg-teal-500' },
  { bar: 'bg-orange-100 text-orange-950 ring-orange-300', dot: 'bg-orange-500' },
  { bar: 'bg-indigo-100 text-indigo-950 ring-indigo-300', dot: 'bg-indigo-500' },
  { bar: 'bg-lime-100 text-lime-950 ring-lime-300', dot: 'bg-lime-500' },
  { bar: 'bg-fuchsia-100 text-fuchsia-950 ring-fuchsia-300', dot: 'bg-fuchsia-500' },
] as const

export function bookingColor(code: string) {
  let hash = 0
  for (const char of code) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return CALENDAR_BOOKING_COLORS[hash % CALENDAR_BOOKING_COLORS.length]!
}

export function calendarAgenda(
  items: AdminCalendarEvent[],
  month: string,
  blocks: PublicBlockedDate[] = [],
) {
  return monthCells(month)
    .filter((date): date is string => Boolean(date))
    .map(date => ({
      date,
      items: eventsOnDate(items, date),
      blocks: blocksOnDate(blocks, date),
    }))
    .filter(day => day.items.length > 0 || day.blocks.length > 0)
}
