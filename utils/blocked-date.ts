import type { PublicBlockedDate } from '../types/availability'
import { toCalendarDate } from './availability'

export function toPublicBlockedDate(
  row: {
    uuid: string
    starts_on: string
    ends_on: string
    reason: string | null
  },
  product: { uuid: string, name: string },
): PublicBlockedDate {
  return {
    uuid: row.uuid,
    startsOn: toCalendarDate(row.starts_on),
    endsOn: toCalendarDate(row.ends_on),
    reason: row.reason,
    productUuid: product.uuid,
    productName: product.name,
  }
}
