import type { VoucherDiscountType, VoucherStatus } from '~/utils/constants'

export interface PublicVoucher {
  uuid: string
  code: string
  name: string
  discountType: VoucherDiscountType
  discountValue: number
  maxRedemptions: number | null
  redeemedCount: number
  minSubtotal: number
  startsOn: string | null
  endsOn: string | null
  status: VoucherStatus
  displayStatus: string
  createdAt: string
}

export interface PublicRentalVoucher {
  uuid: string
  code: string
  name: string
  discountAmount: number
}

export interface VoucherListResponse {
  items: PublicVoucher[]
  page: number
  pageSize: number
  total: number
}
