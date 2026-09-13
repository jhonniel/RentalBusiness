import type { PaymentStatus } from '~/utils/constants'

export interface PublicPaymentMethod {
  uuid: string
  code: string
  name: string
  accountName: string | null
  accountNumber: string | null
  instructions: string | null
  qrUrl: string | null
  sortOrder: number
  isActive: boolean
}

export interface PublicPayment {
  uuid: string
  amount: number
  currency: string
  provider: string
  status: PaymentStatus
  paymentMethod: string | null
  paidAt: string | null
  checkoutUrl: string | null
  createdAt: string
}

export interface PaymentCheckout {
  payment: PublicPayment
  checkoutUrl: string
  rental: {
    uuid: string
    code: string
    status: string
  }
}
