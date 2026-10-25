import type { CatalogProduct } from '~/types/catalog'

export type ChatTopic
  = | 'quote-available'
    | 'quote-unavailable'
    | 'past-date'
    | 'ask-dates'
    | 'ask-kit'
    | 'coming-soon'
    | 'general'

export const CHAT_MAX_SUGGESTIONS = 3

export function chatStarterSuggestions(live: boolean) {
  return live
    ? ['What equipment is available?', 'How do I book?']
    : ['When will the site be back?', 'What equipment is available?']
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function mentionedProduct(question: string, products: CatalogProduct[]) {
  const query = ` ${normalize(question)} `
  return products.find(product => query.includes(` ${normalize(product.name)} `))
    ?? products.find(product => normalize(product.name).split(' ')
      .some(word => word.length >= 4 && query.includes(` ${word} `)))
}

function topicOf(question: string, fallback: ChatTopic): ChatTopic | 'pay' | 'late' | 'deposit' | 'book' | 'list' | 'location' | 'product' {
  if (fallback !== 'general') {
    return fallback
  }
  const query = normalize(question)
  if (/\b(late|overdue)\b/.test(query)) {
    return 'late'
  }
  if (/\b(pay|payment|gcash|maya|bank|qr)\b/.test(query)) {
    return 'pay'
  }
  if (/\bdeposit\b/.test(query)) {
    return 'deposit'
  }
  if (/\bhow (do|can|to) i? ?(book|rent|reserve)\b|\bbooking steps\b/.test(query)) {
    return 'book'
  }
  if (/\b(what|which) (gear|equipment|items|kits)\b|\bdo you (rent|have)\b|\bavailable (items|equipment|gear)\b/.test(query)) {
    return 'list'
  }
  if (/\b(where|location|address|pickup|delivery|deliver|meetup)\b/.test(query)) {
    return 'location'
  }
  return 'general'
}

export function chatFollowUpSuggestions(input: {
  topic: ChatTopic
  question: string
  asked: string[]
  products: CatalogProduct[]
  productName?: string | null
}) {
  const bookable = input.products.filter(product => !product.comingSoon)
  const mentioned = mentionedProduct(input.question, input.products)
  const focus = input.productName || mentioned?.name || bookable[0]?.name || null
  const others = bookable.map(product => product.name).filter(name => name !== focus)
  let topic = topicOf(input.question, input.topic)
  if (topic === 'general' && mentioned) {
    topic = mentioned.comingSoon ? 'coming-soon' : 'product'
  }
  const about = (template: (name: string) => string) => focus ? template(focus) : null

  const byTopic: Record<string, Array<string | null>> = {
    'quote-available': ['How do I pay?', about(name => `What's included with ${name}?`), 'What if I return it late?'],
    'quote-unavailable': [about(name => `Is ${name} free this weekend?`), about(name => `Is ${name} free tomorrow?`), others[0] ? `Is ${others[0]} free on those dates?` : 'What equipment is available?'],
    'past-date': [about(name => `Is ${name} free tomorrow?`), about(name => `${name} for 3 days from tomorrow`), about(name => `Is ${name} free this weekend?`)],
    'ask-dates': [about(name => `${name} tomorrow for 1 day`), about(name => `${name} for 3 days from tomorrow`), about(name => `${name} this weekend`)],
    'ask-kit': bookable.slice(0, 3).map(product => `Is ${product.name} free tomorrow?`),
    'coming-soon': ['What equipment is available?', ...bookable.slice(0, 2).map(product => `Tell me about ${product.name}`)],
    'pay': ['How do I book?', 'Is the deposit refundable?', 'What if I return it late?'],
    'late': ['Is the deposit refundable?', 'How do I pay?', 'How do I book?'],
    'deposit': ['What if I return it late?', 'How do I pay?', 'How do I book?'],
    'book': [about(name => `Is ${name} free tomorrow?`), 'How do I pay?', 'What equipment is available?'],
    'list': [...bookable.slice(0, 2).map(product => `Tell me about ${product.name}`), 'How do I book?'],
    'product': [about(name => `Is ${name} free tomorrow?`), about(name => `How much is ${name} for 3 days?`), about(name => `What's included with ${name}?`)],
    'location': ['How do I book?', 'What equipment is available?', about(name => `Is ${name} free tomorrow?`)],
    'general': ['What equipment is available?', about(name => `Is ${name} free tomorrow?`), 'How do I book?'],
  }

  const asked = new Set(input.asked.map(normalize))
  return [...new Set((byTopic[topic] ?? byTopic.general).filter((item): item is string => Boolean(item)))]
    .filter(item => !asked.has(normalize(item)))
    .slice(0, CHAT_MAX_SUGGESTIONS)
}
