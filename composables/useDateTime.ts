import { BUSINESS_TIMEZONE } from '~/utils/constants'
import { formatBusinessDate, formatBusinessDateTime } from '~/utils/datetime'

export function useDateTime() {
  return {
    timezone: BUSINESS_TIMEZONE,
    formatBusinessDate,
    formatBusinessDateTime,
  }
}
