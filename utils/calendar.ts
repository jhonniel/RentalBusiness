import type { PublicBlockedDate } from '~/types/availability'
import type { AdminCalendarEvent } from '~/types/calendar'
import { calendarDateInZone } from './datetime'

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

export function eventCoversDate(event: Pick<AdminCalendarEvent, 'startsOn' | 'endsOn'>, date: string) {
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
