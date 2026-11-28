import type { PublicReceipt, ReceiptPurpose, ReceiptSnapshot, ReceiptSnapshotAddonItem, ReceiptSnapshotItem, ReceiptStatementLine } from '~/types/receipt'
import type { Json } from '~/types/database.types'
import { paymentKind } from './payment'
import { rentalPeriodDays } from './rental-window'

/** Older snapshots mixed add-ons into `items` with sku `Add-on`. */
const LEGACY_ADDON_SKU = 'Add-on'

export function receiptKitItems(snapshot: ReceiptSnapshot): ReceiptSnapshotItem[] {
  return (snapshot.items ?? []).filter(item => item.sku !== LEGACY_ADDON_SKU)
}

export function receiptAddonItems(snapshot: ReceiptSnapshot): ReceiptSnapshotAddonItem[] {
  const current = snapshot.addons ?? []
  if (current.length) {
    return current
  }
  return (snapshot.items ?? [])
    .filter(item => item.sku === LEGACY_ADDON_SKU)
    .map(item => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.dailyPrice,
      lineTotal: item.lineTotal,
    }))
}

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

/** Same receipt content, laid out for standard A4 office paper. */
export const RECEIPT_A4_PRINT_CSS = `
@page { size: A4; margin: 14mm 16mm; }
@media print {
  html, body { width: auto; margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .receipt-paper { width: 100% !important; max-width: 178mm !important; margin: 0 auto !important; padding: 0 !important; font-size: 10.5pt !important; line-height: 1.45 !important; color: #111 !important; }
  .receipt-paper * { color: #111 !important; box-shadow: none !important; }
  .receipt-paper > section { margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; }
  .receipt-paper h1 { font-size: 16pt !important; letter-spacing: 0.04em !important; margin-top: 4mm !important; }
  .receipt-paper h2 { font-size: 11pt !important; }
  .receipt-paper p, .receipt-paper dt, .receipt-paper dd, .receipt-paper li, .receipt-paper span, .receipt-paper a { font-size: 10.5pt !important; }
  .receipt-paper .text-xs { font-size: 9pt !important; }
  .receipt-paper dl.grid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 3mm 8mm !important; margin-top: 6mm !important; }
  .receipt-paper dl.grid > div { display: block !important; }
  .receipt-paper dl.grid > div dt { font-size: 9pt !important; color: #555 !important; margin-bottom: 0.5mm !important; }
  .receipt-paper dl.grid > div dd { text-align: left !important; font-weight: 600 !important; }
  .receipt-paper ul, .receipt-paper div.border-y { margin-top: 5mm !important; border-color: #ccc !important; }
  .receipt-paper li { padding: 2.5mm 0 !important; border-color: #e5e5e5 !important; }
  .receipt-paper .rounded-full { display: inline-block !important; padding: 1mm 3mm !important; border: 1px solid #ccc !important; border-radius: 999px !important; background: transparent !important; }
  .receipt-paper .rounded-xl { border: 1px solid #ddd !important; border-radius: 0 !important; background: transparent !important; padding: 4mm !important; }
  .receipt-paper img, .receipt-paper svg { max-width: 48mm !important; height: auto !important; }
  .receipt-paper .receipt-header img { display: block; margin: 0 auto !important; max-width: 52mm !important; }
  .receipt-paper .receipt-header { padding-bottom: 5mm !important; border-bottom: 1px solid #ccc !important; text-align: center !important; }
  .receipt-paper .receipt-footer { margin-top: 8mm !important; padding-top: 5mm !important; border-top: 1px solid #ccc !important; text-align: center !important; }
  .receipt-paper .receipt-footer a { text-decoration: none !important; }
  .receipt-paper .receipt-qr { margin-top: 6mm !important; }
  .receipt-paper .receipt-qr img { width: 32mm !important; height: 32mm !important; max-width: 32mm !important; }
  .receipt-paper .receipt-received-by { font-weight: 600 !important; }
}
`

export const RECEIPT_PURPOSE_LABELS: Record<ReceiptPurpose, string> = {
  booking: 'Booking payment',
  extension: 'Booking extension',
  late_fee: 'Late fee',
  balance: 'Balance payment',
}

/**
 * Kit window on a booking receipt: original booked period before extensions.
 * Prefer live starts + first active extension's previousEndsOn (handles reschedules after the snapshot).
 */
export function receiptBookingWindow(input: {
  startsOn?: string | null
  endsOn?: string | null
  extensions?: Array<{ previousEndsOn: string, cancelledAt?: string | null, createdAt?: string }>
  snapshot?: Pick<ReceiptSnapshot['rental'], 'startsOn' | 'endsOn'> | null
}): { startsOn: string, endsOn: string, days: number } {
  const active = (input.extensions ?? [])
    .filter(extension => !extension.cancelledAt)
    .slice()
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
  const startsOn = input.startsOn || input.snapshot?.startsOn || ''
  const endsOn = active[0]?.previousEndsOn
    || input.endsOn
    || input.snapshot?.endsOn
    || ''
  return {
    startsOn,
    endsOn,
    days: startsOn && endsOn ? rentalPeriodDays(startsOn, endsOn) : 0,
  }
}

/** @deprecated Prefer receiptBookingWindow — kept for callers that only have a snapshot. */
export function receiptKitDays(snapshot: Pick<ReceiptSnapshot, 'rental'>): number {
  return receiptBookingWindow({ snapshot: snapshot.rental }).days
}

/** Kit rent before paid extensions (line totals minus active extension adds). */
export function receiptBookingBaseRent(input: {
  itemLineTotals: number[]
  extensions?: Array<{ addedAmount: number, cancelledAt?: string | null }>
}): number {
  const lines = input.itemLineTotals.reduce((sum, amount) => sum + Math.max(0, amount), 0)
  const extensionTotal = (input.extensions ?? [])
    .filter(extension => !extension.cancelledAt)
    .reduce((sum, extension) => sum + Math.max(0, extension.addedAmount), 0)
  return Math.max(0, Math.round((lines - extensionTotal) * 100) / 100)
}

export function receiptDiscounts(rental: {
  startsOn: string
  endsOn: string
  discountAmount: number
  voucher: { code: string } | null
  items: Array<{
    dailyPrice: number
    quantity: number
    lineTotal: number
    billingUnit?: 'day' | 'hour'
    billedHours?: number | null
    hourlyPrice?: number | null
  }>
}, days: number) {
  const regular = rental.items.reduce((sum, item) => {
    if (item.billingUnit === 'hour' && item.hourlyPrice && item.billedHours) {
      return sum + Math.max(0, item.hourlyPrice) * item.billedHours * Math.max(0, item.quantity)
    }
    return sum + Math.max(0, item.dailyPrice) * Math.max(0, item.quantity) * Math.max(0, days)
  }, 0)
  const charged = rental.items.reduce((sum, item) => sum + Math.max(0, item.lineTotal), 0)
  return {
    longStay: Math.max(0, Math.round((regular - charged) * 100) / 100),
    voucher: Math.max(0, Math.round(rental.discountAmount * 100) / 100),
    voucherCode: rental.voucher?.code ?? null,
  }
}

export function paymentPurpose(metadata: unknown): ReceiptPurpose {
  const kind = paymentKind(metadata)
  return kind === 'refund' ? 'booking' : kind
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
