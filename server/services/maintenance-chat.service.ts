import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { isUsableSecret } from '../../utils/env'
import { FREE_CHAT_AI, maintenanceAssistantPrompt, answerFromKnowledge } from '../../utils/maintenance-chat'
import type { MaintenanceChatInput } from '../../utils/maintenance-chat-validation'
import { calendarDateInZone, isPastBusinessDate } from '../../utils/datetime'
import { STOREFRONT_KIT_PRODUCTS } from '../../utils/storefront'
import {
  chatDatesPrompt,
  chatKitPrompt,
  chatQuestionContext,
  chatQuoteRange,
  formatChatQuoteAnswer,
  formatLiveAvailabilityFacts,
  parseChatQuoteIntent,
  chatNoPickupLeftTodayReply,
  chatPastDateReply,
  chatPickupTime,
  chatActionLinks,
  chatQuoteActions,
  wantsChatLink,
  type ChatBookingAction,
  type ChatKit,
} from '../../utils/chat-quote'
import { addCalendarDays } from '../../utils/expense'
import { AppError } from '../utils/errors'
import { getPublicSupabaseClient, getSupabaseAdminClient } from '../utils/supabase'
import type { CatalogProduct } from '../../types/catalog'
import { answerFromCatalog, catalogActions, catalogFacts, policyFacts, productActions, type ChatShopPolicies } from '../../utils/chat-knowledge'
import { chatFollowUpSuggestions, type ChatTopic } from '../../utils/chat-suggestions'
import { listPublicProductNames } from '../repositories/product.repository'
import { getPublicProducts } from './catalog.service'
import { getActivePaymentMethods } from './payment-method.service'
import { getAdminSettings } from './settings.service'
import { getProductAvailabilityCalendar } from './availability.service'
import { getPublicMaintenanceSafe } from './maintenance.service'
import { quoteRental } from './rental.service'

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
}

function siteOrigin() {
  const config = useRuntimeConfig()
  return String(config.public.siteUrl || process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function groqConfig() {
  const config = useRuntimeConfig()
  return {
    apiKey: String(config.groqApiKey || process.env.GROQ_API_KEY || process.env.NUXT_GROQ_API_KEY || ''),
    baseUrl: String(config.groqBaseUrl || process.env.GROQ_BASE_URL || process.env.NUXT_GROQ_BASE_URL || FREE_CHAT_AI.baseUrl).replace(/\/$/, ''),
    model: String(config.groqModel || process.env.GROQ_MODEL || process.env.NUXT_GROQ_MODEL || FREE_CHAT_AI.model),
  }
}

async function completeWithFreeAi(
  input: MaintenanceChatInput,
  prompt: string,
): Promise<string | null> {
  const { apiKey, baseUrl, model } = groqConfig()
  if (!isUsableSecret(apiKey)) {
    return null
  }

  const models = model === FREE_CHAT_AI.model ? [model] : [model, FREE_CHAT_AI.model]
  for (const candidate of models) {
    const result = await requestChatCompletion(baseUrl, apiKey, candidate, input, prompt)
    if (result !== 'model-unavailable') {
      return result
    }
    console.warn(`[chat] AI model "${candidate}" is unavailable; update GROQ_MODEL.`)
  }
  return null
}

async function requestChatCompletion(
  baseUrl: string,
  apiKey: string,
  model: string,
  input: MaintenanceChatInput,
  prompt: string,
): Promise<string | null | 'model-unavailable'> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 400,
        ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
        messages: [
          { role: 'system', content: prompt },
          ...input.messages.map(message => ({
            role: message.role,
            content: message.content,
          })),
        ],
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      if (response.status === 404 || detail.includes('model_not_found') || detail.includes('model_decommissioned')) {
        return 'model-unavailable'
      }
      console.warn(`[chat] AI request failed with status ${response.status}.`)
      return null
    }

    const payload = await response.json() as ChatCompletionResponse
    const content = plainChatText(payload.choices?.[0]?.message?.content ?? '')
    return content || null
  }
  catch {
    return null
  }
  finally {
    clearTimeout(timer)
  }
}

function plainChatText(value: string) {
  return value
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

interface ChatKnowledge {
  products: CatalogProduct[]
  policies: ChatShopPolicies
  paymentMethods: string[]
}

const KNOWLEDGE_TTL_MS = 60_000
let knowledgeCache: { at: number, value: ChatKnowledge } | null = null

async function loadChatKnowledge(client: SupabaseClient<Database>): Promise<ChatKnowledge> {
  if (knowledgeCache && Date.now() - knowledgeCache.at < KNOWLEDGE_TTL_MS) {
    return knowledgeCache.value
  }

  const admin = getSupabaseAdminClient()
  const [products, settings, methods] = await Promise.all([
    getPublicProducts(client, { page: 1, pageSize: 50 }).then(result => result.items).catch(() => [] as CatalogProduct[]),
    getAdminSettings(admin).catch(() => null),
    getActivePaymentMethods(admin).catch(() => []),
  ])
  const value: ChatKnowledge = {
    products,
    policies: {
      lateFeePolicy: settings?.lateFeePolicy ?? null,
      depositRules: settings?.depositRules ?? null,
      cancellationRules: settings?.cancellationRules ?? null,
    },
    paymentMethods: methods.map(method => method.name),
  }
  knowledgeCache = { at: Date.now(), value }
  return value
}

async function loadChatKits(client: SupabaseClient<Database>): Promise<ChatKit[]> {
  try {
    const rows = await listPublicProductNames(client)
    if (rows.length) {
      return rows.map(row => ({ slug: row.slug, name: row.name }))
    }
  }
  catch {
    // Public catalog is optional; featured kits still work.
  }

  return STOREFRONT_KIT_PRODUCTS.map(kit => ({ slug: kit.slug, name: kit.name }))
}

function kitName(catalog: ChatKit[], slug: string) {
  return catalog.find(kit => kit.slug === slug)?.name
}

async function liveAvailabilityFacts(
  client: SupabaseClient<Database>,
  question: string,
  catalog: ChatKit[],
) {
  const today = calendarDateInZone()
  const intent = parseChatQuoteIntent(question, today, catalog)
  const slugs = intent.slugs.length
    ? intent.slugs
    : catalog.map(kit => kit.slug).slice(0, 8)
  const range = chatQuoteRange({
    ...intent,
    days: intent.days || 30,
    startsOn: intent.startsOn || today,
  }, today)
  const to = range.endsOn > addCalendarDays(today, 30)
    ? range.endsOn
    : addCalendarDays(today, 30)

  const calendars = (await Promise.all(slugs.map(async (productSlug) => {
    try {
      const calendar = await getProductAvailabilityCalendar(client, {
        productSlug,
        quantity: intent.quantity,
        from: today,
        to,
      })
      return {
        name: calendar.product.name,
        from: calendar.from,
        to: calendar.to,
        bookedDates: calendar.bookedDates,
      }
    }
    catch {
      return null
    }
  }))).filter((item): item is { name: string, from: string, to: string, bookedDates: string[] } => Boolean(item))

  return calendars.length ? formatLiveAvailabilityFacts(calendars) : ''
}

async function answerLiveQuote(
  client: SupabaseClient<Database>,
  question: string,
  catalog: ChatKit[],
  comingSoonSlugs: Set<string>,
  cta: 'button' | 'link' = 'button',
): Promise<LiveQuoteAnswer | null> {
  const today = calendarDateInZone()
  const intent = parseChatQuoteIntent(question, today, catalog)
  const hasDates = Boolean(intent.startsOn || intent.endsOn || intent.days)
  if (intent.action === 'none' || (!hasDates && /\bhow many\b/i.test(question))) {
    return null
  }
  const comingSoon = intent.slugs.filter(slug => comingSoonSlugs.has(slug))
  if (comingSoon.length && comingSoon.length === intent.slugs.length) {
    const names = comingSoon.map(slug => kitName(catalog, slug) || slug).join(' and ')
    return {
      reply: `${names} ${comingSoon.length > 1 ? 'are' : 'is'} coming soon and can't be booked yet. Message us on Facebook to know when it becomes available.`,
      actions: comingSoon.slice(0, 3).map(slug => ({ kind: 'view' as const, label: `View ${kitName(catalog, slug) || slug}`, to: `/products/${slug}` })),
      topic: 'coming-soon',
    }
  }
  const firstName = intent.slugs[0] ? kitName(catalog, intent.slugs[0]) ?? null : null
  if (intent.action === 'ask-kit') {
    return { reply: chatKitPrompt(catalog.map(kit => kit.name)), actions: [], topic: 'ask-kit' }
  }
  if (intent.action === 'ask-dates') {
    const slug = intent.slugs[0]
    return {
      reply: chatDatesPrompt(firstName ?? undefined),
      actions: slug && firstName ? [{ kind: 'book' as const, label: `Book ${firstName}`, to: `/rentals/new?product=${encodeURIComponent(slug)}` }] : [],
      topic: 'ask-dates',
      productName: firstName,
    }
  }

  const quoteRange = chatQuoteRange(intent, today)
  if (isPastBusinessDate(quoteRange.startsOn, today)) {
    return { reply: chatPastDateReply(quoteRange.startsOn, today), actions: [], topic: 'past-date', productName: firstName }
  }
  const pickupTime = chatPickupTime(quoteRange.startsOn)
  if (!pickupTime) {
    return { reply: chatNoPickupLeftTodayReply(today), actions: [], topic: 'past-date', productName: firstName }
  }
  const range = { ...quoteRange, pickupTime }

  const slugs = intent.slugs.length
    ? intent.slugs
    : catalog.map(kit => kit.slug).slice(0, 8)
  const replies: string[] = []
  const actions: ChatBookingAction[] = []
  let anyAvailable = false
  let quotedName: string | null = null

  for (const productSlug of slugs) {
    if (comingSoonSlugs.has(productSlug)) {
      continue
    }
    try {
      const quoted = await quoteRental(client, {
        productSlug,
        startsOn: range.startsOn,
        endsOn: range.endsOn,
        pickupTime: range.pickupTime,
        quantity: range.quantity,
      })
      replies.push(formatChatQuoteAnswer(quoted, cta))
      actions.push(...chatQuoteActions(quoted))
      anyAvailable ||= quoted.canFulfill
      quotedName ??= quoted.product.name
    }
    catch (error) {
      if (error instanceof AppError && error.statusCode === 409) {
        replies.push(error.userMessage)
      }
    }
  }

  return replies.length
    ? {
      reply: replies.join('\n\n'),
      actions: actions.slice(0, 3),
      topic: anyAvailable ? 'quote-available' : 'quote-unavailable',
      productName: quotedName ?? firstName,
    } satisfies LiveQuoteAnswer
    : null
}

interface LiveQuoteAnswer {
  reply: string
  actions: ChatBookingAction[]
  topic: ChatTopic
  productName?: string | null
}

export async function answerMaintenanceChat(event: H3Event, input: MaintenanceChatInput) {
  const status = await getPublicMaintenanceSafe()
  const question = chatQuestionContext(input.messages)
  const lastMessage = input.messages[input.messages.length - 1]?.content || ''
  const asked = input.messages.filter(message => message.role === 'user').map(message => message.content)
  let liveFacts = ''
  let knowledge: ChatKnowledge | null = null
  const followUps = (topic: ChatTopic, productName?: string | null) => chatFollowUpSuggestions({
    topic,
    question: lastMessage,
    asked,
    products: knowledge?.products ?? [],
    productName,
  })
  const linkMode = wantsChatLink(lastMessage)
  const withLinks = (answer: { reply: string, actions: ChatBookingAction[], suggestions: string[] }) => {
    if (!linkMode || status.enabled) {
      return answer
    }
    const links = answer.actions.length
      ? answer.actions
      : [{ kind: 'view' as const, label: 'Browse equipment', to: '/products' }]
    return {
      ...answer,
      reply: `${answer.reply}\n\n${chatActionLinks(links, siteOrigin())}`,
      actions: [],
    }
  }

  try {
    const client = await getPublicSupabaseClient(event)
    knowledge = await loadChatKnowledge(client).catch(() => null)
    const catalog = knowledge?.products.length
      ? knowledge.products.map(product => ({ slug: product.slug, name: product.name }))
      : await loadChatKits(client)
    const comingSoonSlugs = new Set(knowledge?.products.filter(product => product.comingSoon).map(product => product.slug) ?? [])
    const quoted = await answerLiveQuote(client, question, catalog, comingSoonSlugs, linkMode ? 'link' : 'button')
    if (quoted) {
      return withLinks({
        reply: quoted.reply,
        actions: status.enabled ? [] : quoted.actions,
        suggestions: followUps(quoted.topic, quoted.productName),
      })
    }
    liveFacts = await liveAvailabilityFacts(client, question, catalog)
  }
  catch {
    // Availability lookup is optional; fall back to knowledge or free AI.
  }

  const context = {
    title: status.title,
    message: status.message,
    enabled: status.enabled,
    liveFacts,
    catalogFacts: knowledge?.products.length ? catalogFacts(knowledge.products) : '',
    policyFacts: knowledge ? policyFacts(knowledge.policies, knowledge.paymentMethods) : '',
    today: calendarDateInZone(),
  }
  const actions = status.enabled ? [] : generalActions(lastMessage, question, knowledge?.products ?? [], linkMode)
  const catalogAnswer = knowledge
    ? answerFromCatalog(lastMessage, knowledge.products, knowledge.policies, knowledge.paymentMethods)
    : null
  const fallback = catalogAnswer || answerFromKnowledge(lastMessage, context)
  const reply = await completeWithFreeAi(input, maintenanceAssistantPrompt({
    ...context,
    buttons: linkMode ? [] : actions.map(action => action.label),
  }))

  return withLinks({
    reply: reply ? withoutEchoedLabels(reply, actions) : fallback,
    actions,
    suggestions: followUps('general'),
  })
}

function withoutEchoedLabels(reply: string, actions: ChatBookingAction[]) {
  const labels = new Set(actions.map(action => action.label.toLowerCase()))
  const cleaned = reply
    .split('\n')
    .filter(line => !labels.has(line.trim().replace(/^[•\-*\s"“[]+|[\s.!"”\]]+$/g, '').toLowerCase()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return cleaned || reply
}

const BOOKING_HELP_RE = /\b(book|booking|reserve|reservation|rent|renting)\b/i

function generalActions(lastMessage: string, question: string, products: CatalogProduct[], linkMode: boolean): ChatBookingAction[] {
  const fromLast = catalogActions(lastMessage, products)
  if (fromLast.length) {
    return fromLast
  }
  if (!linkMode && !BOOKING_HELP_RE.test(lastMessage)) {
    return []
  }
  const fromConversation = catalogActions(question, products)
  if (fromConversation.length) {
    return fromConversation
  }
  const bookable = products.filter(product => !product.comingSoon)
  return bookable.length === 1
    ? productActions(bookable)
    : [{ kind: 'view', label: 'Choose equipment to book', to: '/products' }]
}
