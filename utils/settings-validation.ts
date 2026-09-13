import { z } from 'zod'
import { emailSchema } from './auth-validation'

export const businessSettingsInputSchema = z.object({
  name: z.string().trim().min(2, 'Business name is required.').max(80),
  email: z.union([emailSchema, z.literal('')]).optional().default(''),
  phone: z.string().trim().max(40).optional().default(''),
  address: z.string().trim().max(200).optional().default(''),
  lateFeePolicy: z.string().trim().max(500).optional().default(''),
  depositRules: z.string().trim().max(500).optional().default(''),
  cancellationRules: z.string().trim().max(500).optional().default(''),
}).strict()

export type BusinessSettingsInput = z.infer<typeof businessSettingsInputSchema>
