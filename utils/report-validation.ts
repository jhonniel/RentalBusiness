import { z } from 'zod'
import { REPORT_TYPES } from '../types/report'
import { inclusiveDayCount } from './datetime'
import { REPORT_RANGE_MAX_DAYS } from './report'

export const reportTypeSchema = z.enum(REPORT_TYPES)

export const reportQuerySchema = z.object({
  startsOn: z.string().date().optional(),
  endsOn: z.string().date().optional(),
  format: z.enum(['json', 'csv']).default('json'),
}).strict().refine(data => !data.startsOn || !data.endsOn || data.startsOn <= data.endsOn, {
  message: 'End date must be on or after the start date.',
  path: ['endsOn'],
}).refine((data) => {
  if (!data.startsOn || !data.endsOn) {
    return true
  }
  return inclusiveDayCount(data.startsOn, data.endsOn) <= REPORT_RANGE_MAX_DAYS
}, {
  message: `Choose a range of ${REPORT_RANGE_MAX_DAYS} days or fewer.`,
  path: ['endsOn'],
})

export type ReportQuery = z.infer<typeof reportQuerySchema>
