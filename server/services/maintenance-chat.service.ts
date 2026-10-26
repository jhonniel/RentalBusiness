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
import type { PublicFaq } from '../../types/faq'
import { STARTER_FAQS, faqFacts, matchFaq, rankFaqs } from '../../utils/faq'
import {
  POLICY_DOCUMENTS,
  answerFromSiteKnowledge,
  chatPolicyExcerpts,
  mentionsPolicy,
  rankSiteSections,
  siteKnowledgeActions,
  siteOverviewFacts,
  siteSectionFacts,
  splitPolicySections,
  type SiteSection,
} from '../../utils/site-knowledge'
import { readLegalDocument } from '../utils/legal-document'
import { getPublicFaqs } from './faq.service'
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

  const models = [...new Set([model, FREE_CHAT_AI.model, ...FREE_CHAT_AI.fallbackModels])]
  for (const candidate of models) {
    const result = await requestChatCompletion(baseUrl, apiKey, candidate, input, prompt)
    if (result === 'model-unavailable') {
      console.warn(`[chat] AI model "${candidate}" is unavailable; update GROQ_MODEL.`)
      continue
    }
    if (result === 'rate-limited') {
      continue
    }
    return result
  }
  return null
}

async function requestChatCompletion(
  baseUrl: string,
  apiKey: string,
  model: string,
  input: MaintenanceChatInput,
  prompt: string,
): Promise<string | null | 'model-unavailable' | 'rate-limited'> {
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
      if (response.status === 429) {
        console.warn(`[chat] AI model "${model}" hit its rate limit; trying the next model.`)
        return 'rate-limited'
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
    .replace(/<think>[\s\S]*?(<\/think>|$)/gi, '')
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
  faqs: PublicFaq[]
  siteSections: SiteSection[]
}

async function loadPolicySections() {
  const documents = await Promise.all(POLICY_DOCUMENTS.map(async (doc) => {
    try {
      return splitPolicySections(await readLegalDocument(doc.file), doc.source, doc.path)
    }
    catch {
      return []
    }
  }))
  return documents.flat()
}

const KNOWLEDGE_TTL_MS = 60_000
let knowledgeCache: { at: number, value: ChatKnowledge } | null = null

async function loadChatKnowledge(client: SupabaseClient<Database>): Promise<ChatKnowledge> {
  if (knowledgeCache && Date.now() - knowledgeCache.at < KNOWLEDGE_TTL_MS) {
    return knowledgeCache.value
  }

  const admin = getSupabaseAdminClient()
  const [products, settings, methods, faqs, siteSections] = await Promise.all([
    getPublicProducts(client, { page: 1, pageSize: 50 }).then(result => result.items).catch(() => [] as CatalogProduct[]),
    getAdminSettings(admin).catch(() => null),
    getActivePaymentMethods(admin).catch(() => []),
    getPublicFaqs(admin).catch(() => STARTER_FAQS),
    loadPolicySections(),
  ])
  const value: ChatKnowledge = {
    products,
    policies: {
      lateFeePolicy: settings?.lateFeePolicy ?? null,
      depositRules: settings?.depositRules ?? null,
      cancellationRules: settings?.cancellationRules ?? null,
    },
    paymentMethods: methods.map(method => method.name),
    faqs,
    siteSections,
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
    faqQuestions: (knowledge?.faqs ?? STARTER_FAQS).map(faq => faq.question),
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
    const quoted = isFaqQuestion(lastMessage, knowledge?.faqs ?? STARTER_FAQS, catalog)
      ? null
      : await answerLiveQuote(client, question, catalog, comingSoonSlugs, linkMode ? 'link' : 'button')
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

  const products = knowledge?.products ?? []
  const sections = rankSiteSections(lastMessage, knowledge?.siteSections ?? [], { productNames: products.map(product => product.name) })
  const context = {
    title: status.title,
    message: status.message,
    enabled: status.enabled,
    liveFacts,
    catalogFacts: products.length ? catalogFacts(products) : '',
    policyFacts: knowledge ? policyFacts(knowledge.policies, knowledge.paymentMethods) : '',
    faqFacts: faqFacts(rankFaqs(lastMessage, knowledge?.faqs ?? STARTER_FAQS)),
    siteFacts: siteOverviewFacts({ policies: mentionsPolicy(lastMessage, sections) }),
    policyExcerpts: siteSectionFacts(lastMessage, chatPolicyExcerpts(lastMessage, sections)),
    today: calendarDateInZone(),
  }
  const actions = status.enabled
    ? []
    : mergeActions(generalActions(lastMessage, question, products, linkMode), siteKnowledgeActions(lastMessage, sections))
  const catalogAnswer = knowledge
    ? answerFromCatalog(lastMessage, knowledge.products, knowledge.policies, knowledge.paymentMethods)
    : null
  const faq = matchFaq(lastMessage, knowledge?.faqs ?? STARTER_FAQS)
  const strongFaq = faq && faq.score >= FAQ_STRONG_MATCH ? faq.faq.answer : null
  const looseFaq = faq && faq.score >= FAQ_LOOSE_MATCH ? faq.faq.answer : null
  const siteAnswer = answerFromSiteKnowledge(lastMessage, sections)
  const fallback = strongFaq || catalogAnswer || siteAnswer || looseFaq || answerFromKnowledge(lastMessage, context)
  if (looseFaq && faq) {
    asked.push(faq.faq.question)
  }
  const reply = await completeWithFreeAi(input, maintenanceAssistantPrompt({
    ...context,
    buttons: linkMode ? [] : actions.map(action => action.label),
  }))

  return withLinks({
    reply: reply ? withoutEchoedLabels(reply, actions, [lastMessage, ...(faq ? [faq.faq.question] : [])]) : fallback,
    actions,
    suggestions: followUps('general'),
  })
}

function mergeActions(...groups: ChatBookingAction[][]) {
  const seen = new Set<string>()
  return groups.flat().filter((action) => {
    if (seen.has(action.to)) {
      return false
    }
    seen.add(action.to)
    return true
  }).slice(0, 3)
}

function echoKey(value: string) {
  return value.toLowerCase().replace(/^(q|question)\s*:\s*/, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function withoutEchoedLabels(reply: string, actions: ChatBookingAction[], echoes: string[] = []) {
  const labels = new Set(actions.map(action => echoKey(action.label)))
  const repeated = new Set(echoes.map(echoKey).filter(Boolean))
  let cleaned = reply
    .split('\n')
    .filter((line, index) => !labels.has(echoKey(line))
      && !(index === 0 && repeated.has(echoKey(line)))
      && !/^\s*\[?(terms & conditions|privacy policy|cookie policy)\s+[—-][^.]*\]?\s*$/i.test(line))
    .join('\n')
    .replace(/^(a|answer)\s*:\s*/i, '')
    .trim()

  const opening = cleaned.match(/^[^.?!\n]*\?\s*/)
  if (opening && repeated.has(echoKey(opening[0]))) {
    cleaned = cleaned.slice(opening[0].length)
  }
  for (const action of actions) {
    cleaned = cleaned.replace(new RegExp(`(^|[.!?]\\s+)${escapeRegExp(action.label)}[.!]?\\s*$`, 'i'), '$1')
  }

  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()
  return cleaned || reply
}

const FAQ_STRONG_MATCH = 0.6
const FAQ_LOOSE_MATCH = 0.34

function isFaqQuestion(lastMessage: string, faqs: PublicFaq[], catalog: ChatKit[]) {
  const match = matchFaq(lastMessage, faqs)
  if (!match || match.score < FAQ_STRONG_MATCH) {
    return false
  }
  const intent = parseChatQuoteIntent(lastMessage, calendarDateInZone(), catalog)
  return !intent.slugs.length && !intent.startsOn && !intent.endsOn && !intent.days
}

const BOOKING_HELP_RE = /\b(book|booking|reserve|reservation|rent|renting)\b/i
const NOT_BOOKING_HELP_RE = /\b(cancel\w*|refund\w*|late|overdue|extend\w*|extension|deposit|return\w*|damage\w*|lost|lose)\b/i

function generalActions(lastMessage: string, question: string, products: CatalogProduct[], linkMode: boolean): ChatBookingAction[] {
  const fromLast = catalogActions(lastMessage, products)
  if (fromLast.length) {
    return fromLast
  }
  if (!linkMode && (!BOOKING_HELP_RE.test(lastMessage) || NOT_BOOKING_HELP_RE.test(lastMessage))) {
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
