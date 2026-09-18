import { describe, expect, it } from 'vitest'
import { answerFromKnowledge, FREE_CHAT_AI, maintenanceAssistantPrompt } from '../../utils/maintenance-chat'
import { maintenanceChatInputSchema } from '../../utils/maintenance-chat-validation'
import { isMaintenanceBypassApiPath } from '../../utils/maintenance'

const context = {
  title: 'We\'ll be right back',
  message: 'We are photographing inventory today.',
  enabled: true,
}

describe('maintenance chat', () => {
  it('answers gear, booking, and status questions from business knowledge', () => {
    expect(answerFromKnowledge('What gear do you rent?', context)).toContain('DJI Osmo 360')
    expect(answerFromKnowledge('How do I book a kit?', context)).toContain('waiver')
    expect(answerFromKnowledge('When will the site be back?', context)).toContain('photographing inventory')
    expect(answerFromKnowledge('Where are you located?', context)).toContain('Davao City')
    expect(answerFromKnowledge('Is the down payment refundable after I book?', context)).toContain('not refundable')
  })

  it('points unknown questions to email instead of inventing prices', () => {
    const reply = answerFromKnowledge('What is the CEO middle name?', context)
    expect(reply).toContain('jryrentals@gmail.com')
    expect(reply).not.toContain('₱')
  })

  it('requires the last message to come from the visitor', () => {
    expect(maintenanceChatInputSchema.safeParse({
      messages: [{ role: 'user', content: 'What do you rent?' }],
    }).success).toBe(true)

    expect(maintenanceChatInputSchema.safeParse({
      messages: [{ role: 'assistant', content: 'Hello' }],
    }).success).toBe(false)

    expect(maintenanceChatInputSchema.safeParse({
      messages: [{ role: 'user', content: 'Hi', id: 1 }],
    }).success).toBe(false)
  })

  it('keeps the chat API open during maintenance', () => {
    expect(isMaintenanceBypassApiPath('/api/maintenance/chat')).toBe(true)
    expect(maintenanceAssistantPrompt(context)).toContain('DJI Osmo 360')
    expect(maintenanceAssistantPrompt(context)).not.toContain('Sony A7 IV')
    expect(maintenanceAssistantPrompt({
      ...context,
      liveFacts: 'Starlink Mini: booked dates are 20 Sep 2026. Any other date is available.',
    })).toContain('booked dates are 20 Sep 2026')
    expect(FREE_CHAT_AI.provider).toBe('groq')
    expect(FREE_CHAT_AI.model).toBe('llama-3.1-8b-instant')
    expect(FREE_CHAT_AI.baseUrl).toContain('api.groq.com')
    expect(FREE_CHAT_AI.baseUrl).not.toContain('api.openai.com')
  })
})
