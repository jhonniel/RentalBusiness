import type { PublicPayment } from '~/types/payment'
import type { PublicReceipt } from '~/types/receipt'
import type { PublicRentalVoucher } from '~/types/voucher'
import type { PublicWaiverAcceptance } from '~/types/waiver'
import type { RentalStatus } from '~/utils/constants'

export interface PublicRentalIdentity {
  submittedAt: string
  governmentIdUrl?: string | null
  selfieUrl?: string | null
}

export interface PublicRentalItem {
  uuid: string
  quantity: number
  dailyPrice: number
  lineTotal: number
  product: {
    uuid: string
    slug: string
    name: string
    sku: string
    depositAmount: number
    lateFee: number
    replacementValue: number | null
  }
}

export interface PublicRental {
  uuid: string
  code: string
  status: RentalStatus
  startsOn: string
  endsOn: string
  subtotal: number
  depositAmount: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  notes: string | null
  voucher: PublicRentalVoucher | null
  items: PublicRentalItem[]
  waiver: PublicWaiverAcceptance | null
  identity: PublicRentalIdentity | null
  payments: PublicPayment[]
  receipts: PublicReceipt[]
  customer: {
    uuid: string
    firstName: string
    lastName: string
    phone: string | null
  } | null
  createdAt: string
}

export interface RentalListResponse {
  items: PublicRental[]
  page: number
  pageSize: number
  total: number
}

export interface RentalQuote {
  product: {
    uuid: string
    slug: string
    name: string
    sku: string
  }
  startsOn: string
  endsOn: string
  days: number
  quantity: number
  dailyPrice: number
  lineTotal: number
  depositAmount: number
  subtotal: number
  totalAmount: number
  available: number
  canFulfill: boolean
}
