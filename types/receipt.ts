export interface ReceiptSnapshotItem {
  name: string
  sku: string
  quantity: number
  dailyPrice: number
  lineTotal: number
}

export type ReceiptPurpose = 'booking' | 'extension' | 'late_fee'

export interface ReceiptStatementLine {
  receiptNumber: string
  issuedAt: string
  purpose: ReceiptPurpose
  label: string
  amount: number
  current: boolean
}

export interface ReceiptSnapshot {
  receiptNumber: string
  issuedAt: string
  currency: string
  purpose?: ReceiptPurpose
  description?: string
  rental: {
    uuid: string
    code: string
    startsOn: string
    endsOn: string
  }
  customer: {
    name: string
    email: string | null
  }
  business: {
    name: string
    email: string | null
    phone: string | null
    address: string | null
  }
  items: ReceiptSnapshotItem[]
  amounts: {
    subtotal: number
    depositAmount: number
    totalAmount: number
    paidAmount: number
  }
  payment: {
    uuid: string
    provider: string
    paidAt: string | null
  }
}

export interface PublicReceipt {
  uuid: string
  receiptNumber: string
  issuedAt: string
  snapshot: ReceiptSnapshot
  statement?: {
    lines: ReceiptStatementLine[]
    totalPaid: number
  }
  business?: {
    name: string
    email: string | null
    phone: string | null
    address: string | null
  }
  rental?: {
    startsOn: string
    endsOn: string
    pickupAt?: string | null
    returnAt?: string | null
  }
  discounts?: {
    longStay: number
    voucher: number
    voucherCode: string | null
  }
}
