export type AddonStatus = 'active' | 'archived'

export interface PublicAddon {
  uuid: string
  name: string
  description: string
  unitPrice: number
  quantity: number
  heldQuantity: number
  available: number
  bookable: boolean
  status: AddonStatus
  imageUrl: string | null
  updatedAt: string | null
}

export interface PublicAddonOffer {
  uuid: string
  name: string
  description: string
  unitPrice: number
  available: number
  bookable: boolean
  imageUrl: string | null
}

export interface PublicRentalAddonItem {
  uuid: string
  quantity: number
  unitPrice: number
  lineTotal: number
  addon: {
    uuid: string
    name: string
    imageUrl: string | null
  }
}

export interface AdminAddonListResponse {
  items: PublicAddon[]
  ready: boolean
}

export interface RentalAddonSelection {
  uuid: string
  quantity: number
}

export interface RentalAddonQuoteLine {
  uuid: string
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
  available: number
}
