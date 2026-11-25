import type { EquipmentStatus } from '~/utils/constants'

export interface PublicRegisteredDevice {
  uuid: string
  publicCode: string
  pageUrl: string
  label: string | null
  assetCode: string
  serialNumber: string | null
  condition: string
  status: EquipmentStatus
  bagPin: string | null
  wifiName: string | null
  wifiPassword: string | null
  bagContents: string[]
  notes: string | null
  usageCount: number
  product: {
    uuid: string
    name: string
    sku: string
    includedAccessories: string[]
  }
  assignment: {
    uuid: string
    rentalUuid: string
    rentalCode: string
    customerName: string
    startsOn: string
    endsOn: string
    assignedAt: string
  } | null
  updatedAt: string | null
}

export interface AdminRegisteredDeviceListResponse {
  items: PublicRegisteredDevice[]
  page: number
  pageSize: number
  total: number
  ready: boolean
}

/** Public QR scan before booking unlock — no bag pin, Wi‑Fi, or booking secrets. */
export interface PublicDeviceLockedPreview {
  locked: true
  label: string
  productName: string
}

export interface PublicDevicePage {
  locked?: false
  label: string
  assetCode: string
  serialNumber: string | null
  status: EquipmentStatus
  productName: string
  bagPin: string | null
  wifiName: string | null
  wifiPassword: string | null
  bagContents: string[]
  booking: {
    customerName: string
    customerFirstName: string | null
    rentalCode: string
    startsOn: string
    endsOn: string
    returnAt: string | null
  } | null
}
