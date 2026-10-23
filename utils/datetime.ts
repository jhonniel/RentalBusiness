import { BUSINESS_LOCALE, BUSINESS_TIMEZONE } from './constants'

export function toDate(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new TypeError('Invalid date value.')
  }

  return date
}

export function formatBookingDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) {
    return formatBusinessDate(value)
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${day} ${months[month - 1]} ${year}`
}

export function formatBookingDateRange(startsOn: string, endsOn: string): string {
  const parse = (value: string) => {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number)
    return year && month && day ? { year, month, day } : null
  }
  const start = parse(startsOn)
  const end = parse(endsOn)
  if (!start || !end) {
    return [startsOn, endsOn].filter(Boolean).join(' – ')
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const startMonth = months[start.month - 1]
  const endMonth = months[end.month - 1]
  if (start.year !== end.year) {
    return `${startMonth} ${start.day}, ${start.year} – ${endMonth} ${end.day}, ${end.year}`
  }
  if (start.month !== end.month) {
    return `${startMonth} ${start.day} – ${endMonth} ${end.day}, ${end.year}`
  }
  if (start.day !== end.day) {
    return `${startMonth} ${start.day}–${end.day}, ${end.year}`
  }
  return `${startMonth} ${start.day}, ${end.year}`
}

export function formatBusinessDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  },
): string {
  return new Intl.DateTimeFormat(BUSINESS_LOCALE, {
    timeZone: BUSINESS_TIMEZONE,
    ...options,
  }).format(toDate(value))
}

export function formatBusinessDateTime(value: string | Date): string {
  return formatBusinessDate(value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function isStartBeforeEnd(start: string | Date, end: string | Date): boolean {
  return toDate(start).getTime() < toDate(end).getTime()
}

export function calendarDateInZone(
  value: string | Date = new Date(),
  timeZone: string = BUSINESS_TIMEZONE,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(toDate(value))
}

export function isInclusiveDateRange(startsOn: string, endsOn: string): boolean {
  return startsOn <= endsOn
}

export function isPastBusinessDate(value: string, today: string = calendarDateInZone()): boolean {
  return value < today
}

export function inclusiveDayCount(startsOn: string, endsOn: string): number {
  if (startsOn > endsOn) {
    return 0
  }

  const [startYear, startMonth, startDay] = startsOn.split('-').map(Number)
  const [endYear, endMonth, endDay] = endsOn.split('-').map(Number)
  return Math.round((Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay)) / 86_400_000) + 1
}

export function overlapDayCount(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): number {
  const start = startA > startB ? startA : startB
  const end = endA < endB ? endA : endB
  return inclusiveDayCount(start, end)
}
