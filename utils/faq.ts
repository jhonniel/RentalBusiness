import type { PublicFaq } from '~/types/faq'
import { chatKeywords } from './chat-text'
import { LATE_FEE_TYPE_HINTS } from './late-fee'

export interface FaqRow {
  uuid: string
  question: string
  answer: string
  sort_order: number
  is_active: boolean
  updated_at: string | null
}

export function toPublicFaq(row: FaqRow): PublicFaq {
  return {
    uuid: row.uuid,
    question: row.question,
    answer: row.answer,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  }
}

const STARTER: Array<[string, string]> = [
  ['How do I book?', 'Choose the equipment and your pickup and return dates, sign the rental agreement, take a photo of a government ID and a selfie, then submit your request. After that, open the booking in My rentals and pay on the Pay page.'],
  ['What do I need to rent?', 'A valid government-issued ID and a selfie, both taken during booking, plus a signed rental agreement.'],
  ['What payment methods do you accept?', 'You can pay with the methods shown on the Pay page of your booking, such as GCash and Maya. Scan the QR code there, then send your proof of payment on our Facebook page.'],
  ['Is the deposit refundable?', 'Yes. The security deposit is returned after the equipment comes back and is checked. The down payment that confirms a booking is not refundable.'],
  ['Can I cancel my booking?', 'You can message us on Facebook to cancel. The down payment that confirms a booking is not refundable once the rental is booked.'],
  ['What time is pickup and return?', 'Pick a pickup time between 8:00 AM and 8:00 PM. The return is at the same time on your return date.'],
  ['What happens if I return late?', `Late returns follow the rental agreement: ${LATE_FEE_TYPE_HINTS.schedule}`],
  ['Can I extend my rental?', 'Message us on Facebook before your return time. Extra days depend on availability and are charged per day.'],
  ['Where are you located?', 'We are based in Davao City. Pickup, meetup, or delivery can be arranged after your booking is approved.'],
]

export const STARTER_FAQS: PublicFaq[] = STARTER.map(([question, answer], index) => ({
  uuid: `starter-${index + 1}`,
  question,
  answer,
  sortOrder: (index + 1) * 10,
  isActive: true,
  updatedAt: null,
}))

export function sortFaqs(faqs: PublicFaq[]) {
  return [...faqs].sort((left, right) => left.sortOrder - right.sortOrder || left.question.localeCompare(right.question))
}

export function faqFacts(faqs: PublicFaq[]) {
  return faqs
    .filter(faq => faq.isActive)
    .slice(0, 40)
    .map(faq => `Q: ${faq.question}\nA: ${faq.answer}`)
    .join('\n')
}

export function rankFaqs(question: string, faqs: PublicFaq[], limit = 3) {
  const asked = new Set(chatKeywords(question))
  return faqs
    .filter(faq => faq.isActive)
    .map((faq) => {
      const target = [...new Set(chatKeywords(`${faq.question} ${faq.answer}`))]
      const hits = target.filter(word => asked.has(word)).length
      return { faq, hits }
    })
    .filter(item => item.hits > 0)
    .sort((left, right) => right.hits - left.hits)
    .slice(0, limit)
    .map(item => item.faq)
}

export function matchFaq(question: string, faqs: PublicFaq[]) {
  const asked = new Set(chatKeywords(question))
  if (!asked.size) {
    return null
  }

  let best: { faq: PublicFaq, score: number } | null = null
  for (const faq of faqs) {
    if (!faq.isActive) {
      continue
    }
    const target = [...new Set(chatKeywords(faq.question))]
    if (!target.length) {
      continue
    }
    const hits = target.filter(word => asked.has(word)).length
    const score = hits / Math.max(target.length, asked.size)
    if (hits && (!best || score > best.score)) {
      best = { faq, score }
    }
  }
  return best
}
