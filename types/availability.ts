export interface AvailabilityResponse {
  product: {
    uuid: string
    slug: string
    name: string
    sku: string
  }
  startsOn: string
  endsOn: string
  pickupTime: string
  pickupAt: string
  returnAt: string
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
  bookedDates: string[]
  occupyingWindows: {
    pickupAt: string
    returnAt: string
    quantity: number
  }[]
}

export interface PublicBlockedDate {
  uuid: string
  startsOn: string
  endsOn: string
  reason: string | null
  productUuid: string
  productName: string
}
