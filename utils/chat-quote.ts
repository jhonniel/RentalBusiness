import type { MaintenanceChatAction } from '../types/maintenance'
import type { RentalQuote } from '../types/rental'
import { calendarDateInZone, formatBookingDate } from './datetime'
import { addCalendarDays } from './expense'
import { DEFAULT_PICKUP_TIME, formatPickupClock, isPastBusinessDateTime, pickupTimeSlots, rentalPeriodDays } from './rental-window'
import { formatMoney } from './currency'
import { STOREFRONT_KIT_PRODUCTS } from './storefront'

export const CHAT_QUOTE_MAX_DAYS = 90

export interface ChatQuoteIntent {
  action: 'none' | 'ask-kit' | 'ask-dates' | 'quote'
  slugs: string[]
  startsOn: string | null
  endsOn: string | null
  days: number | null
  quantity: number
}

export interface ChatKit {
  slug: string
  name: string
}

interface KitAlias {
  slug: string
  keywords: string[]
}

const KIT_ALIASES: KitAlias[] = [
  { slug: 'starlink-mini', keywords: ['starlink mini', 'starlink', 'star link'] },
  { slug: 'dji-air-3', keywords: ['dji air 3', 'air 3', 'air3', 'drone'] },
  { slug: 'dji-osmo-360', keywords: ['dji osmo 360', 'osmo 360', 'osmo', 'action camera', '360 camera'] },
  { slug: 'jbl-partybox-encore-essential-2', keywords: ['jbl', 'partybox', 'party box', 'speaker'] },
]

const NAME_STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'plus', 'of', 'a', 'an'])

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
const BOOK_RE = /\b(book|reserve)\b|\brent\s+(the|a|an|this|that|it)\b/
const HOW_TO_RE = /\bhow\s+(do|can|to)\b/

export const CHAT_KIT_PROMPT = `Which kit? I can check ${STOREFRONT_KIT_PRODUCTS.map(kit => kit.name).join(', ')}. Name the gear, the dates, and how many days.`
export const CHAT_DATES_PROMPT = 'Which dates do you want? I can check if that kit is free that day.'

export function chatDatesPrompt(name?: string) {
  return name
    ? `Which dates do you want for ${name}? I can check if it is free that day.`
    : CHAT_DATES_PROMPT
}

export function chatKitPrompt(names: string[] = []) {
  const list = names.length
    ? names.join(', ')
    : STOREFRONT_KIT_PRODUCTS.map(kit => kit.name).join(', ')
  return `Which kit? I can check ${list}. Name the gear and the dates.`
}

const DATE_WORD_FIXES: Array<[RegExp, string]> = [
  [/\b(?:the\s+)?day\s+after\s+(?:tomorrow|tommorow|tomorow|tommorrow)\b|\bovermorrow\b|\bsamakalawa\b/g, 'overmorrow'],
  [/\b(?:tommorow|tommorrow|tomorow|tomorro|tomoro|tommoro|tmrw|tmr|tmw|2morrow|2moro|2mrw|bukas)\b/g, 'tomorrow'],
  [/\b(?:tdy|todayy|ngayon)\b/g, 'today'],
  [/\b(?:untill|untl|til)\b/g, 'until'],
  [/\b(?:munday|mondy)\b/g, 'monday'],
  [/\b(?:tuseday|tusday|tuesdy)\b/g, 'tuesday'],
  [/\b(?:wednsday|wensday|wedensday|wednesdy)\b/g, 'wednesday'],
  [/\b(?:thursdy|thurday|thrusday)\b/g, 'thursday'],
  [/\b(?:firday|frday|fridy|frieday)\b/g, 'friday'],
  [/\b(?:saturdy|satuday|saterday)\b/g, 'saturday'],
  [/\b(?:sundy|sundey)\b/g, 'sunday'],
]

function normalize(value: string) {
  let text = value.toLowerCase().replace(/₱/g, ' php ').replace(/[^a-z0-9\s/.-]/g, ' ').replace(/\s+/g, ' ').trim()
  for (const [pattern, replacement] of DATE_WORD_FIXES) {
    text = text.replace(pattern, replacement)
  }
  return text
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

const RECENT_PAST_DAYS = 183

function bumpIfPast(date: string, today: string) {
  if (date >= today || addCalendarDays(date, RECENT_PAST_DAYS) >= today) {
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
  if (/\btomorrow\b/.test(query) || /\b(?:the\s+)?next\s+day\b/.test(query) || /\bfollowing\s+day\b/.test(query)) {
    dates.push(addCalendarDays(today, 1))
  }
  if (/\bovermorrow\b/.test(query)) {
    dates.push(addCalendarDays(today, 2))
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
  if (token === 'tomorrow' || token === 'next day' || token === 'the next day' || token === 'following day') {
    return addCalendarDays(today, 1)
  }
  if (token === 'overmorrow') {
    return addCalendarDays(today, 2)
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

function dateBitPattern() {
  const months = monthNamesPattern()
  return `(?:20\\d{2}-\\d{2}-\\d{2}|\\d{1,2}[/.]\\d{1,2}(?:[/.]\\d{2,4})?|(?:${months})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s+20\\d{2})?|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${months})(?:\\s+20\\d{2})?|today|tomorrow|overmorrow|(?:the\\s+)?next\\s+day|following\\s+day|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\\d{1,2}(?:st|nd|rd|th)?)`
}

function parseUntilOnly(query: string, today: string) {
  const match = query.match(new RegExp(`\\b(?:until|till|hanggang|up\\s+to)\\s+(${dateBitPattern()})\\b`))
  if (!match || /^\d{1,2}(?:st|nd|rd|th)?$/.test(match[1])) {
    return null
  }
  const endsOn = parseSingleDate(match[1], today)
  return endsOn ? { startsOn: today, endsOn: ensureOnOrAfter(endsOn, today) } : null
}

function parseFromToRange(query: string, today: string) {
  const months = monthNamesPattern()
  const dateBit = dateBitPattern()
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

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}

function quantityToken(token: string) {
  return NUMBER_WORDS[token] ?? Number(token)
}

function parseQuantity(query: string, keywords: string[] = []) {
  const words = Object.keys(NUMBER_WORDS).join('|')
  const amount = `(\\d{1,2}|${words})`
  const notADate = `(?<!(?:${monthNamesPattern()}|to|until|till|from|on|-)\\s?)`
  const patterns = [
    new RegExp(`\\b${amount}\\s*(?:units?|kits?|pieces?|pcs|qty|sets?)\\b`),
    /\bx\s?(\d{1,2})\b/,
    /\b(\d{1,2})\s?x\b/,
    ...keywords
      .filter(keyword => keyword.length >= 3)
      .map(keyword => new RegExp(`${notADate}\\b([1-9]|${words})\\s+(?:pcs\\s+|units?\\s+of\\s+|of\\s+)?(?:the\\s+)?${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)),
  ]
  for (const pattern of patterns) {
    const match = query.match(pattern)
    if (match) {
      return Math.min(99, Math.max(1, quantityToken(match[1])))
    }
  }
  return null
}

function parseWhen(query: string, today: string) {
  const range = parseFromToRange(query, today) || parseUntilOnly(query, today)
  const dates = [...new Set([
    ...parseIsoDates(query),
    ...parseNumericDates(query, today),
    ...parseNamedDates(query, today),
    ...parseRelativeDates(query, today),
  ])].sort()
  return {
    startsOn: range?.startsOn || dates[0] || null,
    endsOn: range?.endsOn || (dates.length > 1 ? dates[dates.length - 1] : null),
    days: range ? null : parseDays(query),
  }
}

function latestWhen(lines: string[], today: string) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const when = parseWhen(lines[index], today)
    if (!when.startsOn && !when.endsOn && !when.days) {
      continue
    }
    if (!when.startsOn && when.days) {
      const earlier = lines.slice(0, index).reverse()
        .map(line => parseWhen(line, today))
        .find(item => item.startsOn && !item.endsOn)
      return { ...when, startsOn: earlier?.startsOn ?? null }
    }
    return when
  }
  return { startsOn: null, endsOn: null, days: null }
}

function extraKitKeywords(name: string, slug: string) {
  const hay = `${name} ${slug}`.toLowerCase()
  const extra: string[] = []
  if (/jbl|partybox/.test(hay)) {
    extra.push('jbl', 'partybox', 'party box', 'speaker')
  }
  if (/starlink/.test(hay)) {
    extra.push('starlink mini', 'starlink', 'star link')
  }
  if (/air-?3|drone/.test(hay)) {
    extra.push('dji air 3', 'air 3', 'air3', 'drone')
  }
  if (/osmo/.test(hay)) {
    extra.push('dji osmo 360', 'osmo 360', 'osmo', 'action camera', '360 camera')
  }
  return extra
}

export function chatKitAliases(catalog: ChatKit[] = []): KitAlias[] {
  if (!catalog.length) {
    return KIT_ALIASES
  }

  const productTokens = catalog.map(product => new Set([
    ...product.name.toLowerCase().split(/\s+/),
    ...product.slug.split('-'),
  ]))
  const tokenCounts = new Map<string, number>()
  for (const tokens of productTokens) {
    for (const token of tokens) {
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1)
    }
  }

  return catalog.map((product) => {
    const name = product.name.toLowerCase()
    const slugWords = product.slug.replace(/-/g, ' ')
    const tokens = [...new Set([...name.split(/\s+/), ...slugWords.split(/\s+/)])]
      .filter(token => token.length >= 3 && !NAME_STOP_WORDS.has(token) && !/^\d+$/.test(token) && (tokenCounts.get(token) ?? 0) <= 1)

    return {
      slug: product.slug,
      keywords: [...new Set([name, slugWords, ...tokens, ...extraKitKeywords(product.name, product.slug)])],
    }
  })
}

function matchKitSlugs(query: string, catalog: ChatKit[] = []) {
  const ranked = chatKitAliases(catalog)
    .map((kit) => {
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

export function parseChatQuoteIntent(question: string, today: string, catalog: ChatKit[] = []): ChatQuoteIntent {
  const query = normalize(question)
  const lines = question.split('\n').map(normalize).filter(Boolean)
  const slugs = matchKitSlugs(query, catalog)
  const { startsOn, endsOn, days } = latestWhen(lines, today)
  const kitKeywords = chatKitAliases(catalog)
    .filter(kit => slugs.includes(kit.slug))
    .flatMap(kit => kit.keywords)
  const quantity = [...lines].reverse()
    .map(line => parseQuantity(line, kitKeywords))
    .find((value): value is number => value !== null) ?? 1
  const wantsPrice = PRICE_RE.test(query)
  const wantsAvailability = AVAIL_RE.test(query)
  const wantsBooking = BOOK_RE.test(query) && !HOW_TO_RE.test(query)
  const hasRange = Boolean(startsOn || days || endsOn)
  const looksLikeQuote = wantsPrice
    || wantsBooking
    || (wantsAvailability && (hasRange || slugs.length > 0))
    || (slugs.length > 0 && hasRange)

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

  if (!slugs.length && (wantsAvailability || wantsBooking) && !wantsPrice) {
    return { ...empty, action: 'ask-kit' }
  }

  if (slugs.length && !hasRange && wantsBooking && !wantsPrice && !wantsAvailability) {
    return { ...empty, action: 'ask-dates' }
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

export function chatPickupTime(startsOn: string, now: Date = new Date()): string | null {
  if (startsOn !== calendarDateInZone(now) || !isPastBusinessDateTime(startsOn, DEFAULT_PICKUP_TIME, now)) {
    return DEFAULT_PICKUP_TIME
  }
  return pickupTimeSlots().find(time => !isPastBusinessDateTime(startsOn, time, now)) ?? null
}

export function chatPastDateReply(startsOn: string, today: string) {
  return `${formatBookingDate(startsOn)} has already passed, so it can't be booked. I can check and book dates from today, ${formatBookingDate(today)}, onward. Which dates do you want?`
}

export function chatNoPickupLeftTodayReply(today: string) {
  return `Pickup times for today, ${formatBookingDate(today)}, are over. The earliest pickup is tomorrow, ${formatBookingDate(addCalendarDays(today, 1))}. Want me to check tomorrow?`
}

export function chatQuoteRange(intent: ChatQuoteIntent, today: string) {
  const startsOn = intent.startsOn || today
  let endsOn = intent.endsOn
  if (!endsOn) {
    const days = Math.min(CHAT_QUOTE_MAX_DAYS, Math.max(1, intent.days || 1))
    endsOn = addCalendarDays(startsOn, days)
  }
  if (endsOn <= startsOn) {
    endsOn = addCalendarDays(startsOn, 1)
  }
  if (rentalPeriodDays(startsOn, endsOn) > CHAT_QUOTE_MAX_DAYS) {
    endsOn = addCalendarDays(startsOn, CHAT_QUOTE_MAX_DAYS)
  }

  return {
    startsOn,
    endsOn,
    pickupTime: DEFAULT_PICKUP_TIME,
    quantity: intent.quantity,
  }
}

export type ChatBookingAction = MaintenanceChatAction

export function chatBookingPath(quote: Pick<RentalQuote, 'startsOn' | 'endsOn' | 'pickupTime' | 'quantity'> & { product: { slug: string } }) {
  const params = new URLSearchParams({
    product: quote.product.slug,
    startsOn: quote.startsOn,
    endsOn: quote.endsOn,
    pickupTime: quote.pickupTime,
    quantity: String(quote.quantity),
  })
  return `/rentals/new?${params.toString()}`
}

export function chatQuoteActions(quote: RentalQuote): ChatBookingAction[] {
  if (quote.canFulfill) {
    return [{
      kind: 'book',
      label: quote.quantity > 1 ? `Book ${quote.quantity} × ${quote.product.name}` : `Book ${quote.product.name}`,
      to: chatBookingPath(quote),
    }]
  }
  if (quote.quantity > 1 && quote.available > 0) {
    return [{
      kind: 'book',
      label: `Book ${quote.available} × ${quote.product.name}`,
      to: chatBookingPath({ ...quote, quantity: quote.available }),
    }]
  }
  return [{ kind: 'view', label: `Pick other dates for ${quote.product.name}`, to: `/products/${quote.product.slug}` }]
}

function unitsLabel(count: number) {
  return count === 1 ? '1 unit' : `${count} units`
}

const CHAT_LINK_RE = /\b(links?|url|web\s?address|website address)\b|\bsend (me )?(the )?(page|site)\b/i

export function wantsChatLink(text: string) {
  return CHAT_LINK_RE.test(text)
}

export function chatActionLinks(actions: ChatBookingAction[], origin: string) {
  const base = origin.replace(/\/$/, '')
  return actions.map(action => `${action.label}: ${base}${action.to}`).join('\n')
}

export function formatChatQuoteAnswer(quote: RentalQuote, cta: 'button' | 'link' = 'button') {
  const below = cta === 'link' ? 'link' : 'button'
  const start = formatBookingDate(quote.startsOn)
  const end = formatBookingDate(quote.endsOn)
  const clock = formatPickupClock(quote.pickupTime)
  const window = `${start} ${clock} to ${end} ${clock}`
  const dayLabel = quote.days === 1 ? '1 day' : `${quote.days} days`
  const rental = formatMoney(quote.lineTotal)
  const due = formatMoney(quote.lineTotal + quote.depositAmount)
  const deposit = formatMoney(quote.depositAmount)
  const units = quote.quantity > 1 ? ` for ${unitsLabel(quote.quantity)}` : ''

  if (quote.canFulfill) {
    return `${quote.product.name} is available${units} from ${window} (${dayLabel}) — those dates are not booked. You can book it. The rental is ${rental}. The amount to pay is ${due}, including a ${deposit} deposit. ${cta === 'link' ? 'Open the link below' : 'Tap the button below'} to book with these details.`
  }

  if (quote.quantity > 1 && quote.available > 0) {
    return `Only ${unitsLabel(quote.available)} of ${quote.product.name} ${quote.available === 1 ? 'is' : 'are'} free from ${window} (${dayLabel}); you asked for ${unitsLabel(quote.quantity)}. You can book ${quote.available === 1 ? 'that unit' : 'those units'} with the ${below} below or try other dates.`
  }

  return `${quote.product.name} is not available from ${window} (${dayLabel}) — those dates are already booked or blocked. If it frees up, the rental would be ${rental}. The amount to pay would be ${due}, including a ${deposit} deposit. Choose other dates with the ${below} below.`
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
