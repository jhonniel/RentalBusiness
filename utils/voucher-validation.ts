import { z } from 'zod'
import { VOUCHER_DISCOUNT_TYPES, VOUCHER_STATUSES } from './constants'
import { generateVoucherCode, normalizeVoucherCode } from './voucher'

const money = z.coerce.number().finite().min(0, 'Amount cannot be negative.')
const optionalDate = z.preprocess(
  value => value === '' || value === null || value === undefined ? null : value,
  z.string().date().nullable(),
)

export const voucherInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(80),
  code: z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) {
        return generateVoucherCode()
      }
      return normalizeVoucherCode(String(value))
    },
    z.string().min(4, 'Code must be at least 4 characters.').max(24).regex(/^[A-Z0-9-]+$/, 'Use letters, numbers, and hyphens only.'),
  ),
  discountType: z.enum(VOUCHER_DISCOUNT_TYPES),
  discountValue: z.coerce.number().finite().positive('Discount must be greater than zero.'),
  maxRedemptions: z.preprocess(
    value => value === '' || value === null || value === undefined ? null : value,
    z.coerce.number().int().min(1).max(10_000).nullable(),
  ),
  minSubtotal: money.default(0),
  startsOn: optionalDate,
  endsOn: optionalDate,
  status: z.enum(VOUCHER_STATUSES).default('active'),
}).strict().refine(data => data.discountType !== 'percent' || data.discountValue <= 100, {
  message: 'Percent discounts cannot be more than 100.',
  path: ['discountValue'],
}).refine(data => !data.startsOn || !data.endsOn || data.startsOn <= data.endsOn, {
  message: 'End date must be on or after the start date.',
  path: ['endsOn'],
})

export const voucherListQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  status: z.enum(VOUCHER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

export const applyVoucherSchema = z.object({
  code: z.string().trim().min(1, 'Enter a voucher code.').max(24),
}).strict()

export type VoucherInput = z.infer<typeof voucherInputSchema>
export type ApplyVoucherInput = z.infer<typeof applyVoucherSchema>
