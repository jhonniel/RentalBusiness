import { z } from 'zod'

const money = z.coerce.number({ error: 'Enter a price.' }).finite().min(0, 'Price cannot be negative.').max(1_000_000)
const stock = z.coerce.number({ error: 'Enter a quantity.' }).int('Enter a whole number.').min(0, 'Quantity cannot be negative.').max(99_999)

export const addonInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  unitPrice: money,
  quantity: stock.default(0),
  bookable: z.boolean().default(true),
  status: z.enum(['active', 'archived']).default('active'),
}).strict()

export type AddonInput = z.infer<typeof addonInputSchema>

export const productAddonLinksSchema = z.object({
  addonUuids: z.array(z.string().uuid()).max(100),
}).strict()

export type ProductAddonLinksInput = z.infer<typeof productAddonLinksSchema>

export const rentalAddonSelectionSchema = z.object({
  uuid: z.string().uuid('Choose a valid add-on.'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1.').max(1, 'You can request one of each add-on.'),
}).strict()

export const rentalAddonsField = z.array(rentalAddonSelectionSchema).max(50).default([])
