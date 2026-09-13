import { z } from 'zod'
import { PAYMENT_STATUSES } from './constants'
import { isRentalCode } from './rental'

export const createPaymentSchema = z.object({
  rentalUuid: z.string().uuid().optional(),
  rentalCode: z.string().trim().max(40).optional(),
}).strict().refine(data => Boolean(data.rentalUuid || data.rentalCode), {
  message: 'Choose a rental.',
  path: ['rentalUuid'],
}).refine(data => !data.rentalCode || isRentalCode(data.rentalCode), {
  message: 'Choose a valid rental.',
  path: ['rentalCode'],
})

export const paymentWebhookSchema = z.object({
  provider: z.string().trim().min(1).max(40),
  providerTransactionId: z.string().trim().min(1).max(120),
  status: z.enum(PAYMENT_STATUSES),
  paymentMethod: z.string().trim().max(80).optional(),
  paidAt: z.string().datetime().optional(),
}).strict()

export const sandboxCompleteSchema = z.object({
  paymentUuid: z.string().uuid(),
  outcome: z.enum(['paid', 'failed']),
}).strict()

export const paymentIdentifierSchema = z.string().uuid()

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type PaymentWebhookInput = z.infer<typeof paymentWebhookSchema>
export type SandboxCompleteInput = z.infer<typeof sandboxCompleteSchema>
