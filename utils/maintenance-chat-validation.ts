import { z } from 'zod'

export const maintenanceChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1, 'Add a message.').max(500),
}).strict()

export const maintenanceChatInputSchema = z.object({
  messages: z.array(maintenanceChatMessageSchema).min(1).max(12),
}).strict().refine(value => value.messages.at(-1)?.role === 'user', {
  message: 'The last message must come from the visitor.',
  path: ['messages'],
})

export type MaintenanceChatInput = z.infer<typeof maintenanceChatInputSchema>
