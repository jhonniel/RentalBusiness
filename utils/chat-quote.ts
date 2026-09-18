import type { RentalQuote } from '../types/rental'
import { formatBookingDate, inclusiveDayCount } from './datetime'
import { addCalendarDays } from './expense'
import { formatMoney } from './currency'
import { STOREFRONT_KIT_PRODUCTS } from './storefront'

export const CHAT_QUOTE_MAX_DAYS = 90

export interface ChatQuoteIntent {
  action: 'none' | 'ask-kit' | 'quote'
  slugs: string[]
  startsOn: string | null
  endsOn: string | null
  days: number | null
  quantity: number
}

interface KitAlias {
  slug: string
  keywords: string[]
}

const KIT_ALIASES: KitAlias[] = [
  { slug: 'starlink-mini', keywords: ['starlink mini', 'starlink', 'star link'] },
  { slug: 'dji-air-3', keywords: ['dji air 3', 'air 3', 'air3', 'drone'] },
  { slug: 'dji-osmo-360', keywords: ['dji osmo 360', 'osmo 360', 'osmo', 'action camera', '360 camera'] },
]

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
}

const PRICE_RE = /\b(how much|price|prices|cost|costs|rate|rates|peso|php|quote|deposit|fee|fees|total|amount|magkano)\b|₱/
const AVAIL_RE = /\b(available|availability|free|stock|booked|booking|taken|reserved|occupied|vacant|open)\b|\bthat date\b|\bthose dates\b|\bthis date\b/

export const CHAT_KIT_PROMPT = `Which kit? I can check ${STOREFRONT_KIT_PRODUCTS.map(kit => kit.name).join(', ')}. Name the gear, the dates, and how many days.`

function normalize(value: string) {
  return value.toLowerCase().replace(/₱/g, ' php ').replace(/[^a-z0-9\s\/.-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function isoDate(year: number, month: number, day: number) {
  const stamp = Date.UTC(year, month - 1, day)
  const date = new Date(stamp)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null
  }
  return `${year}-${pad(month)}-${pad(day)}`
}

function utcWeekday(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

function bumpIfPast(date: string, today: string) {
  if (date >= today) {
    return date
  }
  const [year, month, day] = date.split('-').map(Number)
  return isoDate(year + 1, month, day) || date
}

function ensureOnOrAfter(date: string, floor: string) {
  if (date >= floor) {
    return date
  }
  const [year, month, day] = date.split('-').map(Number)
  return isoDate(year + 1, month, day) || date
}

function onOrAfterWeekday(today: string, weekday: number) {
  const delta = (weekday - utcWeekday(today) + 7) % 7
  return addCalendarDays(today, delta)
}

function parseIsoDates(query: string) {
  return [...query.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)]
    .map(match => isoDate(Number(match[1]), Number(match[2]), Number(match[3])))
    .filter((value): value is string => Boolean(value))
}

function parseNumericDates(query: string, today: string) {
  const yearNow = Number(today.slice(0, 4))
  const dates: string[] = []

  for (const match of query.matchAll(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/g)) {
    const first = Number(match[1])
    const second = Number(match[2])
    let year = match[3] ? Number(match[3]) : yearNow
    if (year < 100) {
      year += 2000
    }
    const dmy = first > 12
    const mdy = second > 12
    const day = dmy || !mdy ? first : second
    const month = dmy || !mdy ? second : first
    const iso = isoDate(year, month, day)
    if (iso) {
      dates.push(bumpIfPast(iso, today))
    }
  }

  return dates
}

function parseNamedDates(query: string, today: string) {
  const yearNow = Number(today.slice(0, 4))
  const dates: string[] = []
  const monthNames = Object.keys(MONTHS).join('|')

  const patterns = [
    new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?\\b`, 'g'),
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})(?:\\s+(\\d{4}))?\\b`, 'g'),
  ]

  for (const [index, pattern] of patterns.entries()) {
    for (const match of query.matchAll(pattern)) {
      const monthToken = index === 0 ? match[1] : match[2]
      const dayToken = index === 0 ? match[2] : match[1]
      const yearToken = match[3]
      const month = MONTHS[monthToken]
      const day = Number(dayToken)
      const year = yearToken ? Number(yearToken) : yearNow
      const iso = isoDate(year, month, day)
      if (iso) {
        dates.push(bumpIfPast(iso, today))
      }
    }
  }

  return dates
}

function parseRelativeDates(query: string, today: string) {
  const dates: string[] = []

  if (/\btoday\b/.test(query)) {
    dates.push(today)
  }
  if (/\btomorrow\b/.test(query)) {
    dates.push(addCalendarDays(today, 1))
  }
  if (/\bweekend\b/.test(query)) {
    dates.push(onOrAfterWeekday(today, 6))
  }

  for (const [name, weekday] of Object.entries(WEEKDAYS)) {
    if (name.length < 3) {
      continue
    }
    if (new RegExp(`\\b${name}\\b`).test(query)) {
      dates.push(onOrAfterWeekday(today, weekday))
    }
  }

  return dates
}

function monthNamesPattern() {
  return Object.keys(MONTHS).join('|')
}

function parseSingleDate(
  raw: string,
  today: string,
  inherit?: { month?: number, year?: number },
) {
  const token = raw.trim().toLowerCase()
  if (!token) {
    return null
  }

  const yearNow = inherit?.year || Number(today.slice(0, 4))
  const isoMatch = token.match(/^(20\d{2})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const iso = isoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]))
    return iso ? bumpIfPast(iso, today) : null
  }

  const numeric = token.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/)
  if (numeric) {
    const first = Number(numeric[1])
    const second = Number(numeric[2])
    let year = numeric[3] ? Number(numeric[3]) : yearNow
    if (year < 100) {
      year += 2000
    }
    const dmy = first > 12 || second <= 12
    const day = dmy ? first : second
    const month = dmy ? second : first
    const iso = isoDate(year, month, day)
    return iso ? bumpIfPast(iso, today) : null
  }

  if (token === 'today') {
    return today
  }
  if (token === 'tomorrow') {
    return addCalendarDays(today, 1)
  }
  if (token === 'weekend') {
    return onOrAfterWeekday(today, 6)
  }

  for (const [name, weekday] of Object.entries(WEEKDAYS)) {
    if (name.length >= 3 && token === name) {
      return onOrAfterWeekday(today, weekday)
    }
  }

  const months = monthNamesPattern()
  const monthDay = token.match(new RegExp(`^(${months})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?$`))
  if (monthDay) {
    const iso = isoDate(monthDay[3] ? Number(monthDay[3]) : yearNow, MONTHS[monthDay[1]], Number(monthDay[2]))
    return iso ? bumpIfPast(iso, today) : null
  }

  const dayMonth = token.match(new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?\\s+(${months})(?:\\s+(\\d{4}))?$`))
  if (dayMonth) {
    const iso = isoDate(dayMonth[3] ? Number(dayMonth[3]) : yearNow, MONTHS[dayMonth[2]], Number(dayMonth[1]))
    return iso ? bumpIfPast(iso, today) : null
  }

  const dayOnly = token.match(/^(\d{1,2})(?:st|nd|rd|th)?$/)
  if (dayOnly && inherit?.month) {
    const iso = isoDate(yearNow, inherit.month, Number(dayOnly[1]))
    return iso ? bumpIfPast(iso, today) : null
  }

  return null
}

function parseFromToRange(query: string, today: string) {
  const months = monthNamesPattern()
  const dateBit = `(?:20\\d{2}-\\d{2}-\\d{2}|\\d{1,2}[/.]\\d{1,2}(?:[/.]\\d{2,4})?|(?:${months})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s+20\\d{2})?|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${months})(?:\\s+20\\d{2})?|today|tomorrow|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\\d{1,2}(?:st|nd|rd|th)?)`
  const connector = '(?:to|until|till|til|through|hanggang|-)'

  const sameMonth = query.match(new RegExp(`\\b(${months})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*${connector}\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(20\\d{2}))?\\b`))
  if (sameMonth) {
    const year = sameMonth[4] ? Number(sameMonth[4]) : Number(today.slice(0, 4))
    const month = MONTHS[sameMonth[1]]
    const start = parseSingleDate(`${sameMonth[1]} ${sameMonth[2]} ${year}`, today)
    const end = parseSingleDate(sameMonth[3], today, { month, year })
    if (start && end) {
      return { startsOn: start, endsOn: ensureOnOrAfter(end, start) }
    }
  }

  const dayMonthRange = query.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*${connector}\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+(${months})(?:\\s+(20\\d{2}))?\\b`))
  if (dayMonthRange) {
    const year = dayMonthRange[4] ? Number(dayMonthRange[4]) : Number(today.slice(0, 4))
    const start = parseSingleDate(`${dayMonthRange[1]} ${dayMonthRange[3]} ${year}`, today)
    const end = parseSingleDate(`${dayMonthRange[2]} ${dayMonthRange[3]} ${year}`, today)
    if (start && end) {
      return { startsOn: start, endsOn: ensureOnOrAfter(end, start) }
    }
  }

  const spanned = query.match(new RegExp(`\\b(?:from\\s+)?(${dateBit})\\s+${connector}\\s+(${dateBit})\\b`))
  if (!spanned) {
    return null
  }

  const startsOn = parseSingleDate(spanned[1], today)
  if (!startsOn) {
    return null
  }

  const endsOn = parseSingleDate(spanned[2], today, {
    month: Number(startsOn.slice(5, 7)),
    year: Number(startsOn.slice(0, 4)),
  })
  if (!endsOn) {
    return null
  }

  return {
    startsOn,
    endsOn: ensureOnOrAfter(endsOn, startsOn),
  }
}

function parseDays(query: string) {
  if (/\bweekend\b/.test(query)) {
    return 2
  }

  const dayMatch = query.match(/\b(\d{1,2})\s*-?\s*days?\b/)
  if (dayMatch) {
    return Number(dayMatch[1])
  }

  const weekMatch = query.match(/\b(\d{1,2})\s*-?\s*weeks?\b/)
  if (weekMatch) {
    return Number(weekMatch[1]) * 7
  }

  if (/\b(a|one|1)\s+week\b/.test(query) || /\bweekly\b/.test(query)) {
    return 7
  }

  return null
}

function parseQuantity(query: string) {
  const match = query.match(/\b(\d{1,2})\s*(units?|kits?|pieces?|pcs|qty)\b/)
  if (!match) {
    return 1
  }
  return Math.min(99, Math.max(1, Number(match[1])))
}

function matchKitSlugs(query: string) {
  const ranked = KIT_ALIASES
    .map(kit => {
      const keyword = kit.keywords.find(item => query.includes(item))
      return keyword ? { slug: kit.slug, score: keyword.length } : null
    })
    .filter((item): item is { slug: string, score: number } => Boolean(item))
    .sort((left, right) => right.score - left.score)

  return [...new Set(ranked.map(item => item.slug))]
}

export function chatQuestionContext(messages: Array<{ role: string, content: string }>) {
  return messages
    .filter(message => message.role === 'user')
    .slice(-4)
    .map(message => message.content)
    .join('\n')
}

export function parseChatQuoteIntent(question: string, today: string): ChatQuoteIntent {
  const query = normalize(question)
  const slugs = matchKitSlugs(query)
  const range = parseFromToRange(query, today)
  const dates = [
    ...parseIsoDates(query),
    ...parseNumericDates(query, today),
    ...parseNamedDates(query, today),
    ...parseRelativeDates(query, today),
  ]
  const uniqueDates = [...new Set(dates)].sort()
  const startsOn = range?.startsOn || uniqueDates[0] || null
  const endsOn = range?.endsOn || (uniqueDates.length > 1 ? uniqueDates[uniqueDates.length - 1] : null)
  const days = range ? null : parseDays(query)
  const quantity = parseQuantity(query)
  const wantsPrice = PRICE_RE.test(query)
  const wantsAvailability = AVAIL_RE.test(query)
  const hasRange = Boolean(startsOn || days || endsOn)
  const looksLikeQuote = wantsPrice || (wantsAvailability && (hasRange || slugs.length > 0)) || (slugs.length > 0 && hasRange)

  const empty: ChatQuoteIntent = {
    action: 'none',
    slugs,
    startsOn,
    endsOn,
    days,
    quantity,
  }

  if (!query || !looksLikeQuote) {
    return empty
  }

  if (!slugs.length && wantsAvailability && !wantsPrice) {
    return { ...empty, action: 'ask-kit' }
  }

  return {
    action: 'quote',
    slugs,
    startsOn,
    endsOn,
    days,
    quantity,
  }
}

export function chatQuoteRange(intent: ChatQuoteIntent, today: string) {
  const startsOn = intent.startsOn || today
  let endsOn = intent.endsOn
  if (!endsOn) {
    const days = Math.min(CHAT_QUOTE_MAX_DAYS, Math.max(1, intent.days || 1))
    endsOn = addCalendarDays(startsOn, days - 1)
  }
  if (endsOn < startsOn) {
    endsOn = startsOn
  }
  if (inclusiveDayCount(startsOn, endsOn) > CHAT_QUOTE_MAX_DAYS) {
    endsOn = addCalendarDays(startsOn, CHAT_QUOTE_MAX_DAYS - 1)
  }

  return {
    startsOn,
    endsOn,
    quantity: intent.quantity,
  }
}

export function formatChatQuoteAnswer(quote: RentalQuote) {
  const start = formatBookingDate(quote.startsOn)
  const end = formatBookingDate(quote.endsOn)
  const window = quote.startsOn === quote.endsOn
    ? start
    : `${start} to ${end}`
  const dayLabel = quote.days === 1 ? '1 day' : `${quote.days} days`
  const rental = formatMoney(quote.lineTotal)
  const deposit = formatMoney(quote.depositAmount)
  const path = `/products/${quote.product.slug}`

  const dateNoun = quote.startsOn === quote.endsOn ? 'that date' : 'those dates'

  if (quote.canFulfill) {
    return `${quote.product.name} is available for ${window} (${dayLabel}) — ${dateNoun} ${quote.startsOn === quote.endsOn ? 'is' : 'are'} not booked. The rental is ${rental}, plus a ${deposit} deposit. Book it at ${path}`
  }

  return `${quote.product.name} is booked for ${window} (${dayLabel}) — ${dateNoun} ${quote.startsOn === quote.endsOn ? 'is' : 'are'} not available. If it frees up, the rental would be ${rental}, plus a ${deposit} deposit. Choose other dates at ${path}`
}

export function formatLiveAvailabilityFacts(kits: Array<{
  name: string
  from: string
  to: string
  bookedDates: string[]
}>) {
  return kits.map((kit) => {
    const window = `${formatBookingDate(kit.from)} to ${formatBookingDate(kit.to)}`
    if (!kit.bookedDates.length) {
      return `${kit.name}: every date from ${window} is available (not booked).`
    }
    const booked = kit.bookedDates.map(date => formatBookingDate(date)).join(', ')
    return `${kit.name}: booked dates are ${booked}. Any other date from ${window} is available.`
  }).join(' ')
}
