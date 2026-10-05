import { z } from 'zod'
import { RENTAL_STATUSES } from './constants'
import { calendarDateInZone, isPastBusinessDate } from './datetime'
import { DEFAULT_PICKUP_TIME, isPastBusinessDateTime, isPickupTime } from './rental-window'

const pickupTimeField = z.string().trim().default(DEFAULT_PICKUP_TIME).refine(isPickupTime, {
  message: 'Choose a pickup time.',
})

const rentalWindow = {
  startsOn: z.string().date('Choose a start date.'),
  endsOn: z.string().date('Choose a return date.'),
  pickupTime: pickupTimeField,
  quantity: z.coerce.number().int().min(1).max(99).default(1),
}

function addDateWindowChecks<T extends z.ZodType<{ startsOn: string, endsOn: string, pickupTime: string }>>(schema: T) {
  return schema.refine(data => data.startsOn <= data.endsOn, {
    message: 'Return date must be on or after the pickup date.',
    path: ['endsOn'],
  }).refine(data => !isPastBusinessDate(data.startsOn, calendarDateInZone()), {
    message: 'Choose today or a future date.',
    path: ['startsOn'],
  })
}

function addWindowChecks<T extends z.ZodType<{ startsOn: string, endsOn: string, pickupTime: string }>>(schema: T) {
  return addDateWindowChecks(schema).refine(data => !isPastBusinessDateTime(data.startsOn, data.pickupTime), {
    message: 'Choose a later pickup time.',
    path: ['pickupTime'],
  })
}

export const rentalQuoteQuerySchema = addWindowChecks(z.object({
  productUuid: z.string().uuid().optional(),
  productSlug: z.string().trim().max(80).regex(/^[a-z0-9-]+$/, 'Choose a valid product.').optional(),
  ...rentalWindow,
}).strict().refine(data => Boolean(data.productUuid || data.productSlug), {
  message: 'Choose a product.',
  path: ['productUuid'],
}))

export const createRentalSchema = addWindowChecks(z.object({
  productUuid: z.string().uuid().optional(),
  productSlug: z.string().trim().max(80).regex(/^[a-z0-9-]+$/, 'Choose a valid product.').optional(),
  ...rentalWindow,
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  status: z.enum(['draft', 'pending']).default('draft'),
}).strict().refine(data => Boolean(data.productUuid || data.productSlug), {
  message: 'Choose a product.',
  path: ['productUuid'],
}))

export const rentalListQuerySchema = z.object({
  status: z.enum(RENTAL_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

export const rentalIdentifierSchema = z.string().trim().min(1).max(40)

export const adminRentalQuoteSchema = addDateWindowChecks(z.object({
  productUuid: z.string().uuid().optional(),
  productSlug: z.string().trim().max(80).regex(/^[a-z0-9-]+$/, 'Choose a valid product.').optional(),
  ...rentalWindow,
}).strict().refine(data => Boolean(data.productUuid || data.productSlug), {
  message: 'Choose a product.',
  path: ['productUuid'],
}))

export const continueAdminRentalSchema = addDateWindowChecks(z.object({
  ...rentalWindow,
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
}).strict())

export type CreateRentalInput = z.infer<typeof createRentalSchema>
export type ContinueAdminRentalInput = z.infer<typeof continueAdminRentalSchema>
export type RentalQuoteQuery = z.infer<typeof rentalQuoteQuerySchema>
export type AdminRentalQuoteQuery = z.infer<typeof adminRentalQuoteSchema>
