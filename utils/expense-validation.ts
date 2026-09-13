import { z } from 'zod'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_FREQUENCIES,
  EXPENSE_STATUSES,
} from './constants'

const money = z.coerce.number().finite().min(0, 'Amount cannot be negative.')
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''))

export const expenseInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  category: z.enum(EXPENSE_CATEGORIES),
  description: optionalText(2000),
  amount: money,
  vendor: optionalText(120),
  reference: optionalText(80),
  status: z.enum(['pending', 'paid']).default('pending'),
  notes: optionalText(1000),
  incurredOn: z.string().date('Choose the date this expense was incurred.'),
}).strict()

export const expenseUpdateSchema = expenseInputSchema

export const expenseListQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  status: z.enum(EXPENSE_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

const optionalDate = z.preprocess(
  value => value === '' || value === null || value === undefined ? undefined : value,
  z.string().date().optional(),
)

const optionalAnchorDay = z.preprocess(
  value => value === '' || value === null || value === undefined ? null : value,
  z.coerce.number().int().min(1).max(31).nullable(),
)

export const recurringExpenseInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: money,
  frequency: z.enum(EXPENSE_FREQUENCIES),
  intervalCount: z.coerce.number().int().min(1).max(365).default(1),
  anchorDay: optionalAnchorDay.optional(),
  startOn: z.string().date('Choose a start date.'),
  endOn: optionalDate,
  nextOccurrenceOn: optionalDate,
  vendor: optionalText(120),
  notes: optionalText(1000),
}).strict().refine(data => !data.endOn || data.endOn >= data.startOn, {
  message: 'End date must be on or after the start date.',
  path: ['endOn'],
}).refine(data => !data.nextOccurrenceOn || data.nextOccurrenceOn >= data.startOn, {
  message: 'Next occurrence cannot be before the start date.',
  path: ['nextOccurrenceOn'],
})

export const recurringExpenseListQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  status: z.enum(['active', 'paused', 'ended']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

export const occurrenceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

export const expenseIdentifierSchema = z.string().uuid()

export type ExpenseInput = z.infer<typeof expenseInputSchema>
export type RecurringExpenseInput = z.infer<typeof recurringExpenseInputSchema>
