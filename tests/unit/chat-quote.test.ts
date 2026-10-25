import { describe, expect, it } from 'vitest'
import {
  CHAT_KIT_PROMPT,
  chatDatesPrompt,
  chatQuestionContext,
  chatPastDateReply,
  chatPickupTime,
  chatQuoteActions,
  chatQuoteRange,
  formatChatQuoteAnswer,
  formatLiveAvailabilityFacts,
  parseChatQuoteIntent,
} from '../../utils/chat-quote'
import type { RentalQuote } from '../../types/rental'

const today = '2026-09-18'

function quote(overrides: Partial<RentalQuote> = {}): RentalQuote {
  return {
    product: {
      uuid: '11111111-1111-4111-8111-111111111111',
      slug: 'starlink-mini',
      name: 'Starlink Mini',
      sku: 'SL-MINI',
    },
    startsOn: '2026-09-20',
    endsOn: '2026-09-22',
    pickupTime: '09:00',
    pickupAt: '2026-09-20T01:00:00.000Z',
    returnAt: '2026-09-22T01:00:00.000Z',
    days: 2,
    quantity: 1,
    dailyPrice: 1500,
    rentAmount: 4500,
    lessAmount: 0,
    lineTotal: 4500,
    depositAmount: 2000,
    subtotal: 4500,
    totalAmount: 4500,
    available: 1,
    canFulfill: true,
    ...overrides,
  }
}

describe('chat quote intent', () => {
  it('reads a kit and a calendar date for availability', () => {
    const intent = parseChatQuoteIntent('Is the Starlink available on Sept 20?', today)
    expect(intent.action).toBe('quote')
    expect(intent.slugs).toEqual(['starlink-mini'])
    expect(intent.startsOn).toBe('2026-09-20')
    expect(intent.days).toBeNull()
  })

  it('reads a drone price for a number of days from today', () => {
    const intent = parseChatQuoteIntent('How much is the drone for 3 days?', today)
    expect(intent.action).toBe('quote')
    expect(intent.slugs).toEqual(['dji-air-3'])
    expect(intent.days).toBe(3)
    expect(chatQuoteRange(intent, today)).toMatchObject({
      startsOn: today,
      endsOn: '2026-09-21',
    })
  })

  it('treats this weekend as Saturday for two days', () => {
    const intent = parseChatQuoteIntent('Is the Osmo free this weekend?', today)
    expect(intent.slugs).toEqual(['dji-osmo-360'])
    expect(intent.startsOn).toBe('2026-09-19')
    expect(intent.days).toBe(2)
    expect(chatQuoteRange(intent, today).endsOn).toBe('2026-09-21')
  })

  it('asks which kit when availability has no gear name', () => {
    const intent = parseChatQuoteIntent('Is it available tomorrow?', today)
    expect(intent.action).toBe('ask-kit')
    expect(CHAT_KIT_PROMPT).toContain('Starlink Mini')
  })

  it('quotes every kit when they ask how much without naming one', () => {
    const intent = parseChatQuoteIntent('How much for 3 days?', today)
    expect(intent.action).toBe('quote')
    expect(intent.slugs).toEqual([])
    expect(intent.days).toBe(3)
  })

  it('quotes a from-to date range with the rental total', () => {
    const intent = parseChatQuoteIntent('How much is Starlink from Sept 20 to Sept 22?', today)
    expect(intent.action).toBe('quote')
    expect(intent.slugs).toEqual(['starlink-mini'])
    expect(intent.startsOn).toBe('2026-09-20')
    expect(intent.endsOn).toBe('2026-09-22')
    expect(chatQuoteRange(intent, today)).toMatchObject({
      startsOn: '2026-09-20',
      endsOn: '2026-09-22',
    })
  })

  it('reads a same-month range like Sept 20 to 22', () => {
    const intent = parseChatQuoteIntent('Starlink from Sept 20 to 22', today)
    expect(intent.startsOn).toBe('2026-09-20')
    expect(intent.endsOn).toBe('2026-09-22')
    expect(intent.days).toBeNull()
  })

  it('reads 20-22 September as a from-to window', () => {
    const intent = parseChatQuoteIntent('How much is the drone 20-22 September?', today)
    expect(intent.slugs).toEqual(['dji-air-3'])
    expect(intent.startsOn).toBe('2026-09-20')
    expect(intent.endsOn).toBe('2026-09-22')
  })

  it('does not treat booking how-to as a quote', () => {
    expect(parseChatQuoteIntent('How do I book a kit?', today).action).toBe('none')
    expect(parseChatQuoteIntent('What gear do you rent?', today).action).toBe('none')
  })

  it('checks the JBL when they want to book it the next day', () => {
    const intent = parseChatQuoteIntent('I would like to book the jbl on the next day', today)
    expect(intent.action).toBe('quote')
    expect(intent.slugs).toEqual(['jbl-partybox-encore-essential-2'])
    expect(intent.startsOn).toBe('2026-09-19')
    expect(chatQuoteRange(intent, today)).toMatchObject({
      startsOn: '2026-09-19',
      endsOn: '2026-09-20',
    })
  })

  it('asks for dates when they name a kit but not a day', () => {
    const intent = parseChatQuoteIntent('I want to book the JBL', today)
    expect(intent.action).toBe('ask-dates')
    expect(intent.slugs).toEqual(['jbl-partybox-encore-essential-2'])
    expect(chatDatesPrompt('JBL Partybox Encore Essential 2')).toContain('JBL Partybox Encore Essential 2')
  })

  it('matches a catalog name that is not one of the featured kits', () => {
    const catalog = [
      { slug: 'jbl-partybox-encore-essential-2', name: 'JBL Partybox Encore Essential 2' },
      { slug: 'starlink-mini', name: 'Starlink Mini' },
    ]
    const intent = parseChatQuoteIntent('Is the Partybox free tomorrow?', today, catalog)
    expect(intent.action).toBe('quote')
    expect(intent.slugs).toEqual(['jbl-partybox-encore-essential-2'])
    expect(intent.startsOn).toBe('2026-09-19')
  })
})

describe('chat never books past dates', () => {
  const monday = '2026-10-26'

  it('keeps a recently passed date in the past instead of moving it to next year', () => {
    const intent = parseChatQuoteIntent('How much is Starlink from Sept 20 to 22?', monday)
    expect(intent.startsOn).toBe('2026-09-20')
    expect(chatPastDateReply('2026-09-20', monday)).toContain('has already passed')
  })

  it('still reads early-year dates in December as next year', () => {
    expect(parseChatQuoteIntent('starlink on Jan 5', '2026-12-20').startsOn).toBe('2027-01-05')
  })

  it('uses the next open pickup time today and stops when today is over', () => {
    expect(chatPickupTime('2026-10-26', new Date('2026-10-26T00:00:00+08:00'))).toBe('09:00')
    expect(chatPickupTime('2026-10-26', new Date('2026-10-26T14:10:00+08:00'))).toBe('14:30')
    expect(chatPickupTime('2026-10-26', new Date('2026-10-26T20:30:00+08:00'))).toBeNull()
    expect(chatPickupTime('2026-10-27', new Date('2026-10-26T20:30:00+08:00'))).toBe('09:00')
  })
})

describe('chat dates with typos and follow-ups', () => {
  const monday = '2026-10-26'

  it('reads "tommorow until friday" as a multi-day window', () => {
    const question = chatQuestionContext([
      { role: 'user', content: 'Is the starlink available?' },
      { role: 'assistant', content: 'Which dates?' },
      { role: 'user', content: 'i want to booked tommorow until friday' },
    ])
    const intent = parseChatQuoteIntent(question, monday)
    expect(intent.action).toBe('quote')
    expect(intent.slugs).toEqual(['starlink-mini'])
    expect(chatQuoteRange(intent, monday)).toMatchObject({ startsOn: '2026-10-27', endsOn: '2026-10-30' })
  })

  it('understands common short forms and the day after tomorrow', () => {
    expect(parseChatQuoteIntent('starlink tmrw to saturday', monday).startsOn).toBe('2026-10-27')
    expect(parseChatQuoteIntent('starlink tmrw to saturday', monday).endsOn).toBe('2026-10-31')
    expect(parseChatQuoteIntent('starlink bukas hanggang friday', monday).startsOn).toBe('2026-10-27')
    expect(parseChatQuoteIntent('is starlink free the day after tomorrow?', monday).startsOn).toBe('2026-10-28')
    expect(parseChatQuoteIntent('starlink from tomorrow until firday', monday).endsOn).toBe('2026-10-30')
  })

  it('starts today when they only say until when', () => {
    const intent = parseChatQuoteIntent('can i rent the starlink until friday?', monday)
    expect(chatQuoteRange(intent, monday)).toMatchObject({ startsOn: monday, endsOn: '2026-10-30' })
  })

  it('uses the newest dates instead of an older range in the chat', () => {
    const question = chatQuestionContext([
      { role: 'user', content: 'How much is Starlink from Nov 2 to 4?' },
      { role: 'assistant', content: '...' },
      { role: 'user', content: 'how about tomorrow until friday' },
    ])
    expect(chatQuoteRange(parseChatQuoteIntent(question, monday), monday)).toMatchObject({ startsOn: '2026-10-27', endsOn: '2026-10-30' })
  })

  it('keeps an earlier start date when a later message only gives the number of days', () => {
    const question = chatQuestionContext([
      { role: 'user', content: 'Is starlink free tomorrow?' },
      { role: 'assistant', content: '...' },
      { role: 'user', content: 'for 3 days' },
    ])
    expect(chatQuoteRange(parseChatQuoteIntent(question, monday), monday)).toMatchObject({ startsOn: '2026-10-27', endsOn: '2026-10-30' })
  })
})

describe('chat booking buttons and quantity', () => {
  it('does not match every kit that shares a brand word', () => {
    const catalog = [
      { slug: 'dji-air-3', name: 'DJI Air 3' },
      { slug: 'dji-osmo-360', name: 'DJI OSMO 360' },
    ]
    expect(parseChatQuoteIntent('can i rent the dji air 3 tomorrow?', today, catalog).slugs).toEqual(['dji-air-3'])
  })

  it('reads how many units they want without mistaking dates for units', () => {
    expect(parseChatQuoteIntent('Can I rent 2 starlink from Sept 20 to 22?', today).quantity).toBe(2)
    expect(parseChatQuoteIntent('How much for two units of the drone tomorrow?', today).quantity).toBe(2)
    expect(parseChatQuoteIntent('Is Sept 20 starlink free?', today).quantity).toBe(1)
    expect(parseChatQuoteIntent('starlink from Sept 20 to 22', today).quantity).toBe(1)
  })

  it('links the book button to the booking form with the chat details filled in', () => {
    const [action] = chatQuoteActions(quote({ quantity: 2, available: 2 }))
    expect(action).toEqual({
      kind: 'book',
      label: 'Book 2 × Starlink Mini',
      to: '/rentals/new?product=starlink-mini&startsOn=2026-09-20&endsOn=2026-09-22&pickupTime=09%3A00&quantity=2',
    })
    expect(action.to).not.toContain('11111111')
  })

  it('offers the free units when fewer are free than asked for', () => {
    const partial = quote({ quantity: 3, available: 1, canFulfill: false })
    expect(formatChatQuoteAnswer(partial)).toContain('Only 1 unit of Starlink Mini is free')
    expect(chatQuoteActions(partial)[0]?.to).toContain('quantity=1')
    expect(chatQuoteActions(quote({ canFulfill: false, available: 0 }))[0]).toMatchObject({ kind: 'view', to: '/products/starlink-mini' })
  })
})

describe('chat quote answer', () => {
  it('states availability and PHP totals without database ids', () => {
    const available = formatChatQuoteAnswer(quote())
    expect(available).toContain('Starlink Mini is available')
    expect(available).toContain('₱4,500.00')
    expect(available).toContain('button below')
    expect(available).not.toMatch(/\bSL-MINI\b/)
    expect(available).not.toContain('11111111')

    const booked = formatChatQuoteAnswer(quote({ canFulfill: false, available: 0 }))
    expect(available).toContain('those dates are not booked')
    expect(available).toContain('You can book it')
    expect(booked).toContain('is not available')
    expect(booked).toContain('already booked or blocked')
    expect(booked).toContain('₱4,500.00')
  })

  it('uses conversation history to know which kit a booked date refers to', () => {
    const question = chatQuestionContext([
      { role: 'user', content: 'Starlink Mini' },
      { role: 'assistant', content: 'What dates do you need?' },
      { role: 'user', content: 'Is Sept 20 booked?' },
    ])
    const intent = parseChatQuoteIntent(question, today)
    expect(intent.action).toBe('quote')
    expect(intent.slugs).toEqual(['starlink-mini'])
    expect(intent.startsOn).toBe('2026-09-20')
  })

  it('lists booked dates for the assistant without database ids', () => {
    const facts = formatLiveAvailabilityFacts([
      {
        name: 'Starlink Mini',
        from: '2026-09-18',
        to: '2026-10-18',
        bookedDates: ['2026-09-20'],
      },
    ])
    expect(facts).toContain('Starlink Mini')
    expect(facts).toContain('booked dates are 20 Sep 2026')
    expect(facts).toContain('available')
    expect(facts).not.toContain('11111111')
  })
})
