import { z } from 'zod'
import { EQUIPMENT_STATUSES, PRODUCT_STATUSES } from './constants'

const money = z.coerce.number().finite().min(0, 'Amount cannot be negative.')
const optionalMoney = z.preprocess(
  value => value === '' || value === null || value === undefined ? null : value,
  money.nullable(),
)
const quantity = z.coerce.number().int().min(0, 'Quantity cannot be negative.')

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(80),
  slug: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
}).strict()

export const productInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  sku: z.string().trim().min(1, 'SKU is required.').max(40),
  categoryUuid: z.string().uuid('Choose a category.'),
  description: z.string().trim().max(8000).default(''),
  shortDescription: z.string().trim().max(280).default(''),
  dailyPrice: money,
  weeklyPrice: optionalMoney,
  monthlyPrice: optionalMoney,
  depositAmount: money.default(0),
  lateFee: money.default(0),
  replacementValue: optionalMoney,
  quantity: quantity.default(0),
  reservedQuantity: quantity.default(0),
  rentedQuantity: quantity.default(0),
  damagedQuantity: quantity.default(0),
  maintenanceQuantity: quantity.default(0),
  lostQuantity: quantity.default(0),
  status: z.enum(PRODUCT_STATUSES).default('draft'),
  condition: z.string().trim().min(1).max(40).default('good'),
  specifications: z.record(z.string(), z.string()).default({}),
  includedAccessories: z.array(z.string().trim().min(1)).default([]),
  rentalRules: z.string().trim().max(4000).optional().or(z.literal('')),
  modelPath: z.string().trim().max(240).optional().or(z.literal('')),
  isFeatured: z.boolean().default(false),
}).strict().refine(data => (
  data.reservedQuantity
  + data.rentedQuantity
  + data.damagedQuantity
  + data.maintenanceQuantity
  + data.lostQuantity
) <= data.quantity, {
  message: 'Reserved, rented, damaged, maintenance, and lost units cannot exceed total quantity.',
  path: ['quantity'],
})

export const productListQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  categoryUuid: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

export const equipmentInputSchema = z.object({
  assetCode: z.string().trim().min(1, 'Asset code is required.').max(40),
  serialNumber: z.string().trim().max(80).optional().or(z.literal('')),
  condition: z.string().trim().min(1).max(40).default('good'),
  status: z.enum(EQUIPMENT_STATUSES).default('available'),
  purchaseCost: optionalMoney,
  purchaseDate: z.string().date().optional().or(z.literal('')),
  replacementValue: optionalMoney,
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
}).strict()

export const inventoryListQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  status: z.enum(EQUIPMENT_STATUSES).optional(),
  productUuid: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

const booleanQuery = z.preprocess((value) => {
  if (value === true || value === 'true' || value === '1') {
    return true
  }
  if (value === false || value === 'false' || value === '0' || value === undefined || value === '') {
    return undefined
  }
  return value
}, z.boolean().optional())

export const publicProductListQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  categorySlug: z.string().trim().max(80).regex(/^[a-z0-9-]+$/, 'Choose a valid category.').optional(),
  categoryUuid: z.string().uuid().optional(),
  featured: booleanQuery,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(12),
}).strict()

export const productIdentifierSchema = z.string().trim().min(1).max(80)

export const availabilityQuerySchema = z.object({
  productUuid: z.string().uuid().optional(),
  productSlug: z.string().trim().max(80).regex(/^[a-z0-9-]+$/, 'Choose a valid product.').optional(),
  startsOn: z.string().date('Choose a start date.'),
  endsOn: z.string().date('Choose an end date.'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1.').max(99).default(1),
}).strict().refine(data => Boolean(data.productUuid || data.productSlug), {
  message: 'Choose a product.',
  path: ['productUuid'],
}).refine(data => data.startsOn <= data.endsOn, {
  message: 'End date must be on or after the start date.',
  path: ['endsOn'],
})

export const availabilityCalendarQuerySchema = z.object({
  productUuid: z.string().uuid().optional(),
  productSlug: z.string().trim().max(80).regex(/^[a-z0-9-]+$/, 'Choose a valid product.').optional(),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1.').max(99).default(1),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
}).strict().refine(data => Boolean(data.productUuid || data.productSlug), {
  message: 'Choose a product.',
  path: ['productUuid'],
}).refine(data => !data.from || !data.to || data.from <= data.to, {
  message: 'End date must be on or after the start date.',
  path: ['to'],
})

export type CategoryInput = z.infer<typeof categoryInputSchema>
export type ProductInput = z.infer<typeof productInputSchema>
export type EquipmentInput = z.infer<typeof equipmentInputSchema>
