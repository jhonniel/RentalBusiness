import { z } from 'zod'
import { isReceiptNumber } from './receipt'
import { isRentalCode } from './rental'
import { isUuid } from './slug'

export const receiptIdentifierSchema = z.string().trim().min(1).max(40).refine(
  value => isUuid(value) || isReceiptNumber(value),
  'Choose a valid receipt.',
)

export const rentalReminderSchema = z.object({
  rentalUuid: z.string().uuid().optional(),
  rentalCode: z.string().trim().max(40).optional(),
  type: z.enum(['pickup', 'return']),
}).strict().refine(data => Boolean(data.rentalUuid || data.rentalCode), {
  message: 'Choose a rental.',
  path: ['rentalUuid'],
}).refine(data => !data.rentalCode || isRentalCode(data.rentalCode), {
  message: 'Choose a valid rental.',
  path: ['rentalCode'],
})

export type RentalReminderInput = z.infer<typeof rentalReminderSchema>
