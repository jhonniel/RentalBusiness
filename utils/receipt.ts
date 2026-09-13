import type { PublicReceipt, ReceiptSnapshot } from '~/types/receipt'
import type { Json } from '~/types/database.types'

export interface ReceiptRow {
  uuid: string
  receipt_number: string
  issued_at: string
  snapshot: Json
}

export function isReceiptNumber(value: string): boolean {
  return /^RCP-\d{8}-\d+$/.test(value)
}

export function toReceiptSnapshot(value: Json): ReceiptSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Receipt snapshot is missing.')
  }

  const snapshot = value as unknown as ReceiptSnapshot
  if (!snapshot.rental?.uuid || !Array.isArray(snapshot.items)) {
    throw new Error('Receipt snapshot is incomplete.')
  }

  return snapshot
}

export function toPublicReceipt(row: ReceiptRow): PublicReceipt {
  const snapshot = toReceiptSnapshot(row.snapshot)
  return {
    uuid: row.uuid,
    receiptNumber: row.receipt_number,
    issuedAt: row.issued_at,
    snapshot: {
      ...snapshot,
      receiptNumber: row.receipt_number,
      issuedAt: row.issued_at,
    },
  }
}

export function firstReceipts(value: ReceiptRow | ReceiptRow[] | null | undefined): PublicReceipt[] {
  if (!value) {
    return []
  }

  return (Array.isArray(value) ? value : [value]).map(toPublicReceipt)
}

export function snapshotHasInternalId(snapshot: ReceiptSnapshot): boolean {
  const encoded = JSON.stringify(snapshot)
  return /"id"\s*:/.test(encoded)
}
