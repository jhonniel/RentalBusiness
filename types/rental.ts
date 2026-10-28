import type { RentalFeedbackSummary } from '~/types/feedback'
import type { PublicPayment } from '~/types/payment'
import type { PublicReceipt } from '~/types/receipt'
import type { PublicRentalVoucher } from '~/types/voucher'
import type { PublicWaiverAcceptance } from '~/types/waiver'
import type { RentalStatus } from '~/utils/constants'
import type { LateFeeStatus, LateFeeType } from '~/utils/late-fee'

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
  pickupTime: string
  pickupAt: string
  returnAt: string
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
    email?: string | null
    phone: string | null
  } | null
  commissioner?: {
    uuid: string
    firstName: string
    lastName: string
  } | null
  commissionAmount?: number
  commissionPerDay?: number
  commissionStatus?: 'not_recorded' | 'unclaimed' | 'collected'
  pendingExtensionAmount?: number
  extensionLines?: RentalExtensionLine[]
  lateFee?: RentalLateFee | null
  actualSale?: number
  feedback?: RentalFeedbackSummary | null
  createdAt: string
}

export interface RentalLateFee {
  uuid: string | null
  type: LateFeeType
  status: LateFeeStatus
  amount: number
  hoursLate: number
  daysLate: number
  asOf: string
  returnAt: string
  dailyRent: number
  customAmount: number | null
  paidAt: string | null
  voidedAt: string | null
  voidReason: string | null
  available: boolean
}

export interface RentalExtensionLine {
  uuid: string
  previousEndsOn: string
  endsOn: string
  previousReturnAt: string | null
  returnAt: string
  days: number
  addedAmount: number
  paymentStatus: 'included' | 'unpaid' | 'paid'
}

export interface RentalReschedulePreview {
  startsOn: string
  endsOn: string
  pickupTime: string
  pickupAt: string
  returnAt: string
  days: number
  rentAmount: number
  lessAmount: number
  discountAmount: number
  totalAmount: number
  depositAmount: number
  amountDue: number
  available: number
  canFulfill: boolean
}

export interface RentalExtensionPreview {
  previousEndsOn: string
  endsOn: string
  previousReturnAt: string
  returnAt: string
  days: number
  extensionDays: number
  extensionRentAmount: number
  extensionLessAmount: number
  previousTotalAmount: number
  totalAmount: number
  addedAmount: number
  canFulfill: boolean
}

export interface PublicRentalExtension {
  uuid: string
  previousEndsOn: string
  endsOn: string
  previousReturnAt: string | null
  returnAt: string
  previousTotalAmount: number
  totalAmount: number
  addedAmount: number
  note: string | null
  extendedBy: string | null
  createdAt: string
  cancelledAt: string | null
  cancelReason: string | null
  editedAt: string | null
  paymentStatus: 'included' | 'unpaid' | 'paid'
  paidAt: string | null
  canMarkPaid: boolean
  canCancel: boolean
  canEdit: boolean
  canEditDates: boolean
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
  pickupTime: string
  pickupAt: string
  returnAt: string
  days: number
  quantity: number
  dailyPrice: number
  rentAmount: number
  lessAmount: number
  lineTotal: number
  depositAmount: number
  subtotal: number
  totalAmount: number
  available: number
  canFulfill: boolean
}
