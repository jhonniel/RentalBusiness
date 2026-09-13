import type { PublicPaymentMethod } from '~/types/payment'
import { STORAGE_BUCKETS, publicStorageUrl } from './storage'

export interface PaymentMethodRow {
  uuid: string
  code: string
  name: string
  account_name: string | null
  account_number: string | null
  instructions: string | null
  qr_storage_path: string | null
  sort_order: number
  is_active: boolean
}

export function publicQrUrl(supabaseUrl: string, storagePath: string): string {
  return publicStorageUrl(supabaseUrl, STORAGE_BUCKETS.paymentQr, storagePath)
}

export function toPublicPaymentMethod(row: PaymentMethodRow, supabaseUrl: string): PublicPaymentMethod {
  return {
    uuid: row.uuid,
    code: row.code,
    name: row.name,
    accountName: row.account_name,
    accountNumber: row.account_number,
    instructions: row.instructions,
    qrUrl: row.qr_storage_path ? publicQrUrl(supabaseUrl, row.qr_storage_path) : null,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }
}
