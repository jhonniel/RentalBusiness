import { describe, expect, it } from 'vitest'
import {
  CHAT_KIT_PROMPT,
  chatQuestionContext,
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
    days: 3,
    quantity: 1,
    dailyPrice: 1500,
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
      endsOn: '2026-09-20',
    })
  })

  it('treats this weekend as Saturday for two days', () => {
    const intent = parseChatQuoteIntent('Is the Osmo free this weekend?', today)
    expect(intent.slugs).toEqual(['dji-osmo-360'])
    expect(intent.startsOn).toBe('2026-09-19')
    expect(intent.days).toBe(2)
    expect(chatQuoteRange(intent, today).endsOn).toBe('2026-09-20')
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
})

describe('chat quote answer', () => {
  it('states availability and PHP totals without database ids', () => {
    const available = formatChatQuoteAnswer(quote())
    expect(available).toContain('Starlink Mini is available')
    expect(available).toContain('₱4,500.00')
    expect(available).toContain('/products/starlink-mini')
    expect(available).not.toMatch(/\bSL-MINI\b/)
    expect(available).not.toContain('11111111')

    const booked = formatChatQuoteAnswer(quote({ canFulfill: false, available: 0 }))
    expect(available).toContain('those dates are not booked')
    expect(booked).toContain('is booked')
    expect(booked).toContain('those dates are not available')
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
