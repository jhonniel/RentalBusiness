import { z } from 'zod'
import { EQUIPMENT_STATUSES } from './constants'
import { isRentalCode } from './rental'

const optionalText = (max: number) => z.preprocess(
  value => value === '' || value === null || value === undefined ? null : value,
  z.string().trim().max(max).nullable(),
)

export const registeredDeviceInputSchema = z.object({
  productUuid: z.string().uuid('Choose a product.'),
  label: optionalText(120),
  assetCode: z.string().trim().min(1, 'Asset code is required.').max(40),
  serialNumber: optionalText(80),
  condition: z.string().trim().min(1).max(40).default('good'),
  status: z.enum(EQUIPMENT_STATUSES).default('available'),
  bagPin: optionalText(40),
  wifiName: optionalText(80),
  wifiPassword: optionalText(120),
  bagContents: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
  notes: optionalText(1000),
}).strict()

export const registeredDeviceListQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  status: z.enum(EQUIPMENT_STATUSES).optional(),
  productUuid: z.string().uuid().optional(),
  uuid: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

export const assignDeviceSchema = z.object({
  rentalCode: z.string().trim().min(3, 'Enter a rental code.').max(40),
}).strict()

export const unlockDeviceSchema = z.object({
  rentalCode: z.preprocess(
    value => String(value ?? '').trim().toUpperCase(),
    z.string().min(3, 'Enter your rental booking code.').max(40),
  ),
}).strict().superRefine((data, ctx) => {
  if (!isRentalCode(data.rentalCode)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rentalCode'],
      message: 'Enter a valid rental booking code (for example JRY-20261120-00001).',
    })
  }
})

export type RegisteredDeviceInput = z.infer<typeof registeredDeviceInputSchema>
export type AssignDeviceInput = z.infer<typeof assignDeviceSchema>
export type UnlockDeviceInput = z.infer<typeof unlockDeviceSchema>
