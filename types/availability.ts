export interface AvailabilityResponse {
  product: {
    uuid: string
    slug: string
    name: string
    sku: string
  }
  startsOn: string
  endsOn: string
  capacity: number
  booked: number
  available: number
  requested: number
  canFulfill: boolean
}

export interface AvailabilityCalendar {
  product: {
    uuid: string
    slug: string
    name: string
    sku: string
  }
  from: string
  to: string
  quantity: number
  unavailableDates: string[]
}
