import { z } from 'zod'
import { RENTAL_STATUSES } from './constants'

const productRef = z.object({
  productUuid: z.string().uuid().optional(),
  productSlug: z.string().trim().max(80).regex(/^[a-z0-9-]+$/, 'Choose a valid product.').optional(),
  startsOn: z.string().date('Choose a start date.'),
  endsOn: z.string().date('Choose an end date.'),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
}).strict().refine(data => Boolean(data.productUuid || data.productSlug), {
  message: 'Choose a product.',
  path: ['productUuid'],
}).refine(data => data.startsOn <= data.endsOn, {
  message: 'End date must be on or after the start date.',
  path: ['endsOn'],
})

export const rentalQuoteQuerySchema = productRef

export const createRentalSchema = z.object({
  productUuid: z.string().uuid().optional(),
  productSlug: z.string().trim().max(80).regex(/^[a-z0-9-]+$/, 'Choose a valid product.').optional(),
  startsOn: z.string().date('Choose a start date.'),
  endsOn: z.string().date('Choose an end date.'),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  status: z.enum(['draft', 'pending']).default('draft'),
}).strict().refine(data => Boolean(data.productUuid || data.productSlug), {
  message: 'Choose a product.',
  path: ['productUuid'],
}).refine(data => data.startsOn <= data.endsOn, {
  message: 'End date must be on or after the start date.',
  path: ['endsOn'],
})

export const rentalListQuerySchema = z.object({
  status: z.enum(RENTAL_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

export const rentalIdentifierSchema = z.string().trim().min(1).max(40)

export type CreateRentalInput = z.infer<typeof createRentalSchema>
export type RentalQuoteQuery = z.infer<typeof rentalQuoteQuerySchema>
