import { z } from 'zod'
import { FEEDBACK_RATING_MAX, FEEDBACK_RATING_MIN } from './feedback'

export const sendFeedbackLinkSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(254).optional().or(z.literal('')),
  earnsReward: z.boolean().default(true),
}).strict()

export const submitFeedbackSchema = z.object({
  token: z.string().trim().min(20, 'This feedback link is invalid.').max(200),
  answers: z.array(z.object({
    key: z.string().trim().min(1).max(160),
    rating: z.coerce.number().int().min(FEEDBACK_RATING_MIN, 'Choose 1 to 5 stars.').max(FEEDBACK_RATING_MAX, 'Choose 1 to 5 stars.'),
  }).strict()).min(1, 'Rate each question.').max(30),
  comment: z.string().trim().max(2000, 'Keep your comment under 2,000 characters.').optional().or(z.literal('')),
}).strict()

export const adminFeedbackListQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  device: z.string().trim().max(160).optional(),
  status: z.enum(['submitted', 'sent', 'expired', 'all']).default('submitted'),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

export type AdminFeedbackListQuery = z.infer<typeof adminFeedbackListQuerySchema>
export type SendFeedbackLinkInput = z.infer<typeof sendFeedbackLinkSchema>
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>
