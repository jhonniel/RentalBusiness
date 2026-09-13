export interface ReceiptSnapshotItem {
  name: string
  sku: string
  quantity: number
  dailyPrice: number
  lineTotal: number
}

export interface ReceiptSnapshot {
  receiptNumber: string
  issuedAt: string
  currency: string
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
}
