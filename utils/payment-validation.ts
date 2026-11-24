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

export const markAdminPaidSchema = z.object({
  paymentMethod: z.enum(['cash', 'gcash', 'maya', 'bank']).default('cash'),
  paymentType: z.enum(['full', 'partial']).default('full'),
  /** Required for partial: how much the customer paid now. Must be less than the full amount due. */
  amount: z.coerce.number({ error: 'Enter how much was paid.' })
    .finite()
    .positive('Enter how much was paid.')
    .max(1_000_000, 'That amount is too large.')
    .optional(),
}).strict().superRefine((data, ctx) => {
  if (data.paymentType === 'partial' && data.amount === undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'Enter how much the customer paid.',
      path: ['amount'],
    })
  }
})

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type PaymentWebhookInput = z.infer<typeof paymentWebhookSchema>
export type SandboxCompleteInput = z.infer<typeof sandboxCompleteSchema>
export type MarkAdminPaidInput = z.infer<typeof markAdminPaidSchema>
