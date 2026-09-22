import type { PublicBlockedDate } from '~/types/availability'
import type { CalendarRentalStatus } from '~/utils/constants'

export interface AdminCalendarEvent {
  uuid: string
  code: string
  status: CalendarRentalStatus
  startsOn: string
  endsOn: string
  productName: string
  customerName: string | null
}

export interface AdminCalendar {
  month: string
  startsOn: string
  endsOn: string
  timezone: string
  items: AdminCalendarEvent[]
  blockedDates: PublicBlockedDate[]
}
