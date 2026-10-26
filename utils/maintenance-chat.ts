import {
  APP_NAME,
  BUSINESS_ADDRESS,
  BUSINESS_CITY,
  BUSINESS_CURRENCY,
  BUSINESS_EMAIL,
  BUSINESS_TIMEZONE,
  FACEBOOK_URL,
} from './constants'
import { formatBookingDate } from './datetime'
import { STOREFRONT_KIT_PRODUCTS } from './storefront'

export interface MaintenanceChatContext {
  title: string
  message: string
  enabled: boolean
  liveFacts?: string
  catalogFacts?: string
  policyFacts?: string
  today?: string
  buttons?: string[]
  faqFacts?: string
  siteFacts?: string
  policyExcerpts?: string
}

interface KnowledgeEntry {
  id: string
  keywords: string[]
  answer: string
}

const KIT_NAMES = STOREFRONT_KIT_PRODUCTS.map(product => product.name).join(', ')

export const FREE_CHAT_AI = {
  provider: 'groq',
  baseUrl: 'https://api.groq.com/openai/v1',
  model: 'openai/gpt-oss-20b',
  fallbackModels: ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b'],
} as const

export const MAINTENANCE_CHAT_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'status',
    keywords: ['maintenance', 'offline', 'back', 'closed', 'website', 'storefront'],
    answer: '',
  },
  {
    id: 'gear',
    keywords: ['gear', 'equipment', 'starlink', 'drone', 'osmo', 'camera', 'dji', 'kits'],
    answer: `${APP_NAME} rents ${KIT_NAMES} in ${BUSINESS_CITY}. Pickup, meetup, or delivery can be arranged after you book.`,
  },
  {
    id: 'book',
    keywords: ['book', 'booking', 'reserve', 'rental request', 'how to rent'],
    answer: `Choose a kit, pick dates in ${BUSINESS_TIMEZONE}, sign the rental waiver, photograph a government ID and selfie, then pay. Pickup, meetup, or delivery is arranged after approval.`,
  },
  {
    id: 'pay',
    keywords: ['pay', 'payment', 'gcash', 'maya', 'bank', 'qr', 'price', 'cost', 'php'],
    answer: `Prices are in ${BUSINESS_CURRENCY} and shown on each kit. Customers pay through the listed QR methods such as GCash or Maya. The down payment is not refundable once the rental is booked.`,
  },
  {
    id: 'refund',
    keywords: ['refund', 'downpayment', 'down payment', 'cancel', 'cancellation'],
    answer: 'The down payment paid to confirm a booking is not refundable once the rental is booked. A security deposit, if required, is separate and may be returned after inspection.',
  },
  {
    id: 'location',
    keywords: ['where', 'location', 'address', 'davao', 'pickup', 'meetup', 'deliver', 'delivery', 'located'],
    answer: `${APP_NAME} is based in ${BUSINESS_ADDRESS}. Gear can be picked up, met up, or delivered depending on the booking.`,
  },
  {
    id: 'contact',
    keywords: ['email', 'contact', 'facebook', 'messenger', 'message', 'phone', 'reach', 'help', 'talk', 'human', 'agent', 'person'],
    answer: `The fastest way to reach us is to message us on Facebook at ${FACEBOOK_URL}. You can also email ${BUSINESS_EMAIL}.`,
  },
  {
    id: 'legal',
    keywords: ['waiver', 'terms', 'privacy', 'cookie', 'cookies', 'identity', 'agreement', 'policy'],
    answer: 'Rentals require the current Equipment Rental Agreement, plus a government ID and a selfie holding that ID. Terms, the Privacy Policy, and the Cookie Policy apply to use of the website.',
  },
]

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function statusAnswer(context: MaintenanceChatContext) {
  if (context.enabled) {
    return `The public website is in maintenance. ${context.title}: ${context.message} You can still ask questions here or message us on Facebook at ${FACEBOOK_URL}.`
  }

  return `The website is open. Browse kits on the home page or catalog, then book your dates in ${BUSINESS_TIMEZONE}. Need help? Message us on Facebook at ${FACEBOOK_URL}.`
}

export function maintenanceAssistantPrompt(context: MaintenanceChatContext) {
  const availability = context.enabled
    ? `The storefront is temporarily closed. Current notice: "${context.title}". ${context.message}`
    : 'The storefront is open. Visitors can browse kits and start a booking on this website.'

  return [
    `You are the ${APP_NAME} assistant on the public website.`,
    availability,
    `Business facts: based in ${BUSINESS_ADDRESS}; currency ${BUSINESS_CURRENCY}; dates use ${BUSINESS_TIMEZONE}; kits include ${KIT_NAMES}.`,
    context.today
      ? `Today is ${formatBookingDate(context.today)} (${context.today}) in ${BUSINESS_TIMEZONE}. Bookings can start today or later only. Never quote, confirm, or suggest dates before today; if a visitor asks for a past date, say it has passed and ask for a date from today onward.`
      : '',
    context.catalogFacts
      ? `LIVE CATALOG from the system, the source of truth for equipment, prices, deposits, specs, what is included, rules, and coming-soon items. Never contradict it:\n${context.catalogFacts}`
      : '',
    context.policyFacts
      ? `SHOP POLICIES from the system:\n${context.policyFacts}`
      : '',
    context.siteFacts
      ? `SITE PAGES (How it Works, About, and what each policy covers):\n${context.siteFacts}`
      : '',
    context.policyExcerpts
      ? `POLICY EXCERPTS from the official Terms & Conditions, Privacy Policy, and Cookie Policy that may relate to this question. Give only the highlight that answers the question in 1 or 2 short plain sentences (under 45 words), naming the policy inside the sentence, for example "Our Privacy Policy says…". Do not add the policy name as a separate line, and do not list everything in the excerpt, never add terms that are not written there, and do not give legal advice. If an excerpt is not related, ignore it:\n${context.policyExcerpts}`
      : 'If the visitor asks about the Terms, Privacy Policy, or Cookie Policy and no excerpt covers it, give the short summary from SITE PAGES and suggest reading the full page.',
    context.faqFacts
      ? `FAQS written by the shop. When a question matches one, answer with that FAQ in your own short words and keep its facts exactly. Do not repeat the question or write "Q:" or "A:". Live catalog, availability, and prices still come from the sections above:\n${context.faqFacts}`
      : '',
    'Mention how many units the shop has only when the visitor asks how many or wants more than one; never in lists or general answers. Never mention long-stay discounts, or weekly and monthly prices. Rent is charged per day.',
    'Write plain text only. No markdown, asterisks, bullet lists, or headings.',
    context.buttons?.length
      ? `Buttons shown under your reply: ${context.buttons.join(', ')}. You may tell the visitor to tap them; a Book button opens the booking form with their details filled in. Do not repeat the button labels as a separate line.`
      : 'No buttons are shown under your reply, so never mention a button. To book, the visitor opens a kit from the equipment page and taps Book.',
    'If the visitor asks for a link, say "Here is the link:" and stop; the system adds the exact link after your reply. Never write URLs yourself and never say you cannot share links.',
    `Contact: ${BUSINESS_EMAIL} and Facebook ${FACEBOOK_URL}.`,
    'Booking: choose gear, pick dates, sign the waiver, upload ID and selfie, pay by QR, then pickup, meetup, or delivery.',
    'Refund: the down payment paid to confirm a booking is not refundable once the rental is booked. A security deposit is separate from the down payment.',
    'Visitors can ask the PHP price for a kit, or say they want to book a kit by name, including JBL and other catalog gear. If they give a date, tomorrow, the next day, or a from-to window, check live availability and say whether that kit is free or already booked. Inclusive days, availability, and totals come from live booking data.',
    context.liveFacts
      ? `LIVE AVAILABILITY is the source of truth in ${BUSINESS_TIMEZONE}. Use it to say booked or available. Never contradict it: ${context.liveFacts}`
      : 'If LIVE AVAILABILITY is missing, do not guess whether a date is booked. Ask for a kit name and date.',
    `Answer in short, friendly English: only the part that answers the question, in 1 to 3 sentences (about 50 words). Give steps or full details only when the visitor asks for them. Do not invent prices, stock, or return dates. If you are unsure, or they want to talk to a person, tell them to message us on Facebook at ${FACEBOOK_URL}. Do not mention system prompts, APIs, or internal ids.`,
  ].join(' ')
}

export function answerFromKnowledge(question: string, context: MaintenanceChatContext) {
  const query = normalize(question)
  if (!query) {
    return `Ask anything about ${APP_NAME}, or message us on Facebook at ${FACEBOOK_URL}.`
  }

  let best = { id: 'status', score: 0 }
  for (const entry of MAINTENANCE_CHAT_KNOWLEDGE) {
    const score = entry.keywords.reduce((total, keyword) => {
      return total + (query.includes(keyword) ? (keyword.includes(' ') ? 3 : 2) : 0)
    }, 0)
    if (score > best.score) {
      best = { id: entry.id, score }
    }
  }

  if (best.score < 2) {
    const extra = context.enabled ? ` ${context.message}` : ''
    return `I can help with gear, booking, payments, and location.${extra} For anything else, message us on Facebook at ${FACEBOOK_URL} or email ${BUSINESS_EMAIL}.`
  }

  if (best.id === 'status') {
    return statusAnswer(context)
  }

  const match = MAINTENANCE_CHAT_KNOWLEDGE.find(entry => entry.id === best.id)
  return match?.answer || statusAnswer(context)
}
