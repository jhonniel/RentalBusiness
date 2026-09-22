import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { isUsableSecret } from '../../utils/env'
import { FREE_CHAT_AI, maintenanceAssistantPrompt, answerFromKnowledge } from '../../utils/maintenance-chat'
import type { MaintenanceChatInput } from '../../utils/maintenance-chat-validation'
import { calendarDateInZone, isPastBusinessDate } from '../../utils/datetime'
import { STOREFRONT_KIT_PRODUCTS } from '../../utils/storefront'
import {
  CHAT_KIT_PROMPT,
  chatQuestionContext,
  chatQuoteRange,
  formatChatQuoteAnswer,
  formatLiveAvailabilityFacts,
  parseChatQuoteIntent,
} from '../../utils/chat-quote'
import { addCalendarDays } from '../../utils/expense'
import { getPublicSupabaseClient } from '../utils/supabase'
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

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 280,
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
      return null
    }

    const payload = await response.json() as ChatCompletionResponse
    const content = payload.choices?.[0]?.message?.content?.trim()
    return content || null
  }
  catch {
    return null
  }
  finally {
    clearTimeout(timer)
  }
}

async function liveAvailabilityFacts(
  client: SupabaseClient<Database>,
  question: string,
) {
  const today = calendarDateInZone()
  const intent = parseChatQuoteIntent(question, today)
  const slugs = intent.slugs.length
    ? intent.slugs
    : STOREFRONT_KIT_PRODUCTS.map(kit => kit.slug)
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
        bookedDates: calendar.unavailableDates,
      }
    }
    catch {
      return null
    }
  }))).filter((item): item is { name: string, from: string, to: string, bookedDates: string[] } => Boolean(item))

  return calendars.length ? formatLiveAvailabilityFacts(calendars) : ''
}

async function answerLiveQuote(client: SupabaseClient<Database>, question: string) {
  const today = calendarDateInZone()
  const intent = parseChatQuoteIntent(question, today)
  if (intent.action === 'none') {
    return null
  }
  if (intent.action === 'ask-kit') {
    return CHAT_KIT_PROMPT
  }

  const range = chatQuoteRange(intent, today)
  if (isPastBusinessDate(range.startsOn, today)) {
    return 'Those dates are in the past and cannot be booked.'
  }

  const slugs = intent.slugs.length
    ? intent.slugs
    : STOREFRONT_KIT_PRODUCTS.map(kit => kit.slug)
  const replies: string[] = []

  for (const productSlug of slugs) {
    try {
      const quoted = await quoteRental(client, {
        productSlug,
        startsOn: range.startsOn,
        endsOn: range.endsOn,
        quantity: range.quantity,
      })
      replies.push(formatChatQuoteAnswer(quoted))
    }
    catch {
      // Skip kits that are missing or cannot be quoted.
    }
  }

  return replies.length ? replies.join('\n\n') : null
}

export async function answerMaintenanceChat(event: H3Event, input: MaintenanceChatInput) {
  const status = await getPublicMaintenanceSafe()
  const question = chatQuestionContext(input.messages)
  let liveFacts = ''

  try {
    const client = await getPublicSupabaseClient(event)
    const quoted = await answerLiveQuote(client, question)
    if (quoted) {
      return { reply: quoted }
    }
    liveFacts = await liveAvailabilityFacts(client, question)
  }
  catch {
    // Availability lookup is optional; fall back to knowledge or free AI.
  }

  const context = {
    title: status.title,
    message: status.message,
    enabled: status.enabled,
    liveFacts,
  }
  const fallback = answerFromKnowledge(input.messages[input.messages.length - 1]?.content || '', context)
  const reply = await completeWithFreeAi(input, maintenanceAssistantPrompt(context))

  return {
    reply: reply || fallback,
  }
}
