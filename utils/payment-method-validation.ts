import { z } from 'zod'

export const paymentMethodInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(80),
  code: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/, 'Use a lowercase code.').optional(),
  accountName: z.string().trim().max(120).optional().or(z.literal('')),
  accountNumber: z.string().trim().max(80).optional().or(z.literal('')),
  instructions: z.string().trim().max(2000).optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
}).strict()

export type PaymentMethodInput = z.infer<typeof paymentMethodInputSchema>
