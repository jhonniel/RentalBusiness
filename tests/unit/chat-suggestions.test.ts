import { describe, expect, it } from 'vitest'
import type { CatalogProduct } from '../../types/catalog'
import { chatFollowUpSuggestions, chatStarterSuggestions } from '../../utils/chat-suggestions'

function product(name: string, comingSoon = false) {
  return { name, slug: name.toLowerCase().replaceAll(' ', '-'), comingSoon } as CatalogProduct
}

const products = [product('Starlink Mini'), product('DJI Air 3', true), product('JBL Partybox', false)]

function follow(question: string, topic: Parameters<typeof chatFollowUpSuggestions>[0]['topic'] = 'general', productName?: string) {
  return chatFollowUpSuggestions({ topic, question, asked: [question], products, productName })
}

describe('chat suggestion chips', () => {
  it('starts with only a few chips', () => {
    expect(chatStarterSuggestions(true)).toEqual(['What equipment is available?', 'How do I book?'])
  })

  it('suggests next steps about the quoted item after a quote', () => {
    expect(follow('Is starlink free tomorrow?', 'quote-available', 'Starlink Mini')).toEqual([
      'How do I pay?',
      'What\'s included with Starlink Mini?',
      'What if I return it late?',
    ])
    expect(follow('Is starlink free tomorrow?', 'quote-unavailable', 'Starlink Mini')).toContain('Is JBL Partybox free on those dates?')
  })

  it('suggests dates when the visitor still has to pick them', () => {
    expect(follow('I want to book the starlink', 'ask-dates', 'Starlink Mini')[0]).toBe('Starlink Mini tomorrow for 1 day')
    expect(follow('Sept 20 starlink', 'past-date', 'Starlink Mini')[0]).toBe('Is Starlink Mini free tomorrow?')
  })

  it('follows the topic of general questions and skips what was already asked', () => {
    expect(follow('Tell me about the Starlink Mini')).toEqual([
      'Is Starlink Mini free tomorrow?',
      'How much is Starlink Mini for 3 days?',
      'What\'s included with Starlink Mini?',
    ])
    expect(follow('What\'s included with Starlink Mini?')).not.toContain('What\'s included with Starlink Mini?')
    expect(follow('How do I pay?')).toEqual(['How do I book?', 'Is the deposit refundable?', 'What if I return it late?'])
    expect(follow('What equipment is available?')).toEqual(['Tell me about Starlink Mini', 'Tell me about JBL Partybox', 'How do I book?'])
    expect(follow('specs of the DJI Air 3')[0]).toBe('What equipment is available?')
  })
})
