import { z } from 'zod'

export const faqInputSchema = z.object({
  question: z.string().trim().min(3, 'Add a question.').max(200, 'Keep the question under 200 characters.'),
  answer: z.string().trim().min(1, 'Add an answer.').max(2000, 'Keep the answer under 2,000 characters.'),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
}).strict()

export type FaqInput = z.infer<typeof faqInputSchema>
