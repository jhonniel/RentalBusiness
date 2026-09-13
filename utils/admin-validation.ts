import { z } from 'zod'
import { CALENDAR_RENTAL_STATUSES, RENTAL_STATUSES } from './constants'

export const adminRentalListQuerySchema = z.object({
  status: z.enum(RENTAL_STATUSES).optional(),
  search: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

export const adminCustomerListQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

export const adminAuditListQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  entity: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

export const adminCalendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  status: z.enum(CALENDAR_RENTAL_STATUSES).optional(),
}).strict()

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict()
