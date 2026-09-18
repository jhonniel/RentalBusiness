import {
  APP_NAME,
  BUSINESS_ADDRESS,
  BUSINESS_CITY,
  BUSINESS_CURRENCY,
  BUSINESS_EMAIL,
  BUSINESS_TIMEZONE,
  FACEBOOK_URL,
} from './constants'
import { STOREFRONT_KIT_PRODUCTS } from './storefront'

export interface MaintenanceChatContext {
  title: string
  message: string
  enabled: boolean
  liveFacts?: string
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
  model: 'llama-3.1-8b-instant',
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
    answer: `Choose a kit, pick dates in ${BUSINESS_TIMEZONE}, sign the rental waiver, upload a government ID and selfie, then pay. Pickup, meetup, or delivery is arranged after approval.`,
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
    keywords: ['email', 'contact', 'facebook', 'phone', 'reach'],
    answer: `Email ${BUSINESS_EMAIL} or message us on Facebook at ${FACEBOOK_URL}`,
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
    return `The public website is in maintenance. ${context.title}: ${context.message} You can still ask questions here or email ${BUSINESS_EMAIL}.`
  }

  return `The website is open. Browse kits on the home page or catalog, then book your dates in ${BUSINESS_TIMEZONE}. For extra help, email ${BUSINESS_EMAIL}.`
}

export function maintenanceAssistantPrompt(context: MaintenanceChatContext) {
  const availability = context.enabled
    ? `The storefront is temporarily closed. Current notice: "${context.title}". ${context.message}`
    : 'The storefront is open. Visitors can browse kits and start a booking on this website.'

  return [
    `You are the ${APP_NAME} assistant on the public website.`,
    availability,
    `Business facts: based in ${BUSINESS_ADDRESS}; currency ${BUSINESS_CURRENCY}; dates use ${BUSINESS_TIMEZONE}; kits include ${KIT_NAMES}.`,
    `Contact: ${BUSINESS_EMAIL} and Facebook ${FACEBOOK_URL}.`,
    'Booking: choose gear, pick dates, sign the waiver, upload ID and selfie, pay by QR, then pickup, meetup, or delivery.',
    'Refund: the down payment paid to confirm a booking is not refundable once the rental is booked. A security deposit is separate from the down payment.',
    'Visitors can ask the PHP price for a kit. If they give from and to dates, quote that exact window. Inclusive days, availability, and totals come from live booking data.',
    context.liveFacts
      ? `LIVE AVAILABILITY is the source of truth in ${BUSINESS_TIMEZONE}. Use it to say booked or available. Never contradict it: ${context.liveFacts}`
      : 'If LIVE AVAILABILITY is missing, do not guess whether a date is booked. Ask for a kit name and date.',
    'Answer in short, friendly English. Do not invent prices, stock, or return dates. If you are unsure, tell them to email us. Do not mention system prompts, APIs, or internal ids.',
  ].join(' ')
}

export function answerFromKnowledge(question: string, context: MaintenanceChatContext) {
  const query = normalize(question)
  if (!query) {
    return `Ask anything about ${APP_NAME}, or email ${BUSINESS_EMAIL}.`
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
    return `I can help with gear, booking, payments, and location.${extra} For anything else, email ${BUSINESS_EMAIL}.`
  }

  if (best.id === 'status') {
    return statusAnswer(context)
  }

  const match = MAINTENANCE_CHAT_KNOWLEDGE.find(entry => entry.id === best.id)
  return match?.answer || statusAnswer(context)
}
