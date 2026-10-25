import type { PublicReceipt, ReceiptPurpose, ReceiptSnapshot, ReceiptStatementLine } from '~/types/receipt'
import type { Json } from '~/types/database.types'

export interface ReceiptRow {
  uuid: string
  receipt_number: string
  issued_at: string
  snapshot: Json
}

export const RECEIPT_58MM_PRINT_CSS = `
@page { size: 58mm auto; margin: 0; }
@media print {
  html, body { width: 58mm; margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .receipt-paper { width: 58mm !important; max-width: 58mm !important; margin: 0 !important; padding: 3mm 2.5mm 6mm !important; font-size: 8.5pt !important; line-height: 1.35 !important; color: #000 !important; }
  .receipt-paper * { color: #000 !important; background: transparent !important; box-shadow: none !important; }
  .receipt-paper section { margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; }
  .receipt-paper section + section, .receipt-paper section section { margin-top: 3mm !important; padding-top: 2mm !important; border-top: 1px dashed #000 !important; }
  .receipt-paper h1 { font-size: 11pt !important; line-height: 1.2 !important; margin-top: 1mm !important; }
  .receipt-paper h2 { font-size: 9pt !important; }
  .receipt-paper p, .receipt-paper dt, .receipt-paper dd, .receipt-paper li, .receipt-paper span, .receipt-paper a { font-size: 8.5pt !important; }
  .receipt-paper dl.grid { display: block !important; margin-top: 2mm !important; }
  .receipt-paper dl.grid > div { display: flex !important; justify-content: space-between; gap: 2mm; padding: 0.4mm 0; }
  .receipt-paper dl.grid > div dd { text-align: right; }
  .receipt-paper ul, .receipt-paper div.border-y { margin-top: 2mm !important; border-color: #000 !important; border-style: dashed !important; }
  .receipt-paper li { padding: 1mm 0 !important; border-color: #000 !important; }
  .receipt-paper .rounded-full { padding: 0 !important; border: 0 !important; }
  .receipt-paper img, .receipt-paper svg { max-width: 30mm !important; height: auto !important; }
  .receipt-paper .receipt-header img { display: block; margin: 0 auto !important; max-width: 34mm !important; }
  .receipt-paper .receipt-header, .receipt-paper .receipt-footer { border-color: #000 !important; text-align: center !important; }
  .receipt-paper .receipt-header { padding-bottom: 2mm !important; }
  .receipt-paper .receipt-footer { margin-top: 3mm !important; padding-top: 2mm !important; }
  .receipt-paper .receipt-footer a { text-decoration: none !important; }
  .receipt-paper .receipt-qr { margin-top: 3mm !important; }
  .receipt-paper .receipt-qr img { width: 28mm !important; height: 28mm !important; max-width: 28mm !important; }
}
`

export const RECEIPT_PURPOSE_LABELS: Record<ReceiptPurpose, string> = {
  booking: 'Booking payment',
  extension: 'Booking extension',
  late_fee: 'Late fee',
}

export function receiptDiscounts(rental: {
  startsOn: string
  endsOn: string
  discountAmount: number
  voucher: { code: string } | null
  items: Array<{ dailyPrice: number, quantity: number, lineTotal: number }>
}, days: number) {
  const regular = rental.items.reduce((sum, item) => sum + Math.max(0, item.dailyPrice) * Math.max(0, item.quantity) * Math.max(0, days), 0)
  const charged = rental.items.reduce((sum, item) => sum + Math.max(0, item.lineTotal), 0)
  return {
    longStay: Math.max(0, Math.round((regular - charged) * 100) / 100),
    voucher: Math.max(0, Math.round(rental.discountAmount * 100) / 100),
    voucherCode: rental.voucher?.code ?? null,
  }
}

export function paymentPurpose(metadata: unknown): ReceiptPurpose {
  const kind = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as { kind?: unknown }).kind
    : null
  return kind === 'extension' || kind === 'late_fee' ? kind : 'booking'
}

export function buildReceiptStatement(
  rows: Array<{
    receipt_number: string
    issued_at: string
    snapshot?: unknown
    payment?: { amount: number | string, status: string, metadata: unknown } | null
  }>,
  currentReceiptNumber: string,
) {
  const lines: ReceiptStatementLine[] = rows
    .filter(row => !row.payment || row.payment.status === 'paid')
    .map((row) => {
      const snapshot = row.snapshot && typeof row.snapshot === 'object' ? row.snapshot as Partial<ReceiptSnapshot> : {}
      const purpose = snapshot.purpose ?? paymentPurpose(row.payment?.metadata)
      return {
        receiptNumber: row.receipt_number,
        issuedAt: row.issued_at,
        purpose,
        label: snapshot.description || RECEIPT_PURPOSE_LABELS[purpose],
        amount: Number(row.payment?.amount ?? snapshot.amounts?.paidAmount ?? 0),
        current: row.receipt_number === currentReceiptNumber,
      }
    })
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))
  const totalPaid = Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100
  return { lines, totalPaid }
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
