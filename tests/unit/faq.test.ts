import { describe, expect, it } from 'vitest'
import { STARTER_FAQS, faqFacts, matchFaq, sortFaqs, toPublicFaq } from '../../utils/faq'
import { faqInputSchema } from '../../utils/faq-validation'
import { faqPageJsonLd } from '../../utils/seo'

describe('FAQs', () => {
  it('maps rows to public FAQs without database ids', () => {
    const faq = toPublicFaq({
      uuid: 'a1',
      question: 'Do you deliver?',
      answer: 'Yes, in Davao City.',
      sort_order: 5,
      is_active: true,
      updated_at: '2026-10-26T00:00:00Z',
    })
    expect(faq).toEqual({ uuid: 'a1', question: 'Do you deliver?', answer: 'Yes, in Davao City.', sortOrder: 5, isActive: true, updatedAt: '2026-10-26T00:00:00Z' })
    expect(Object.keys(faq)).not.toContain('id')
  })

  it('matches how customers phrase common questions', () => {
    expect(matchFaq('can i extend my rental?', STARTER_FAQS)?.faq.question).toBe('Can I extend my rental?')
    expect(matchFaq('is the deposit refundable', STARTER_FAQS)?.score).toBeGreaterThanOrEqual(0.6)
    expect(matchFaq('cancel booking', STARTER_FAQS)?.faq.question).toBe('Can I cancel my booking?')
    expect(matchFaq('what time pickup', STARTER_FAQS)?.faq.question).toBe('What time is pickup and return?')
    expect(matchFaq('hello', STARTER_FAQS)).toBeNull()
  })

  it('skips hidden FAQs for the chat and keeps the shop order', () => {
    const hidden = { ...STARTER_FAQS[0]!, uuid: 'h', question: 'Do you deliver to Cebu?', isActive: false }
    expect(matchFaq('deliver to cebu', [hidden])).toBeNull()
    expect(faqFacts([hidden, STARTER_FAQS[1]!])).not.toContain('Cebu')
    expect(sortFaqs([{ ...STARTER_FAQS[1]!, sortOrder: 1 }, STARTER_FAQS[0]!])[0]?.sortOrder).toBe(1)
  })

  it('validates FAQ input and builds FAQ rich results', () => {
    expect(faqInputSchema.safeParse({ question: 'Hi', answer: 'x' }).success).toBe(false)
    expect(faqInputSchema.parse({ question: 'Do you deliver?', answer: 'Yes.' })).toMatchObject({ sortOrder: 0, isActive: true })
    const jsonLd = faqPageJsonLd('https://jryrentals.com', [{ question: 'Q?', answer: 'A.' }])
    expect(jsonLd['@type']).toBe('FAQPage')
    expect(jsonLd.mainEntity[0]).toMatchObject({ name: 'Q?', acceptedAnswer: { text: 'A.' } })
  })
})
