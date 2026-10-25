export type ExtensionPaymentStatus = 'included' | 'unpaid' | 'paid'

export function extensionPaymentStatus(input: {
  extensionCreatedAt: string
  extensionUuid: string
  mainPaidAt: string | null
  paidExtensionUuids: Iterable<string>
}): ExtensionPaymentStatus {
  const paid = input.paidExtensionUuids instanceof Set
    ? input.paidExtensionUuids
    : new Set(input.paidExtensionUuids)
  if (paid.has(input.extensionUuid)) {
    return 'paid'
  }

  if (!input.mainPaidAt) {
    return 'included'
  }

  return Date.parse(input.extensionCreatedAt) > Date.parse(input.mainPaidAt) ? 'unpaid' : 'included'
}

function paymentKind(metadata: unknown) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as { kind?: unknown, extensionUuid?: unknown })
    : {}
}

export function rentalActualSale(input: {
  totalAmount: number
  commissionAmount: number
  payments: Array<{ status: string, paid_at?: string | null, paidAt?: string | null, created_at?: string, createdAt?: string, metadata?: unknown }>
  extensions: Array<{ uuid: string, added_amount: number | string, created_at: string, cancelled_at?: string | null }>
}) {
  const paid = input.payments.filter(payment => payment.status === 'paid')
  const main = paid
    .filter(payment => !['extension', 'late_fee'].includes(String(paymentKind(payment.metadata).kind ?? '')))
    .sort((a, b) => Date.parse(a.created_at ?? a.createdAt ?? '') - Date.parse(b.created_at ?? b.createdAt ?? ''))[0]
  const paidExtensionUuids = new Set(paid.flatMap((payment) => {
    const meta = paymentKind(payment.metadata)
    return meta.kind === 'extension' && typeof meta.extensionUuid === 'string' ? [meta.extensionUuid] : []
  }))
  const pending = input.extensions
    .filter(extension => !extension.cancelled_at && extensionPaymentStatus({
      extensionCreatedAt: extension.created_at,
      extensionUuid: extension.uuid,
      mainPaidAt: main?.paid_at ?? main?.paidAt ?? null,
      paidExtensionUuids,
    }) === 'unpaid')
    .reduce((sum, extension) => sum + Math.round(Number(extension.added_amount) * 100), 0)
  const rent = Math.round(Math.max(0, input.totalAmount) * 100)
  const commission = Math.round(Math.max(0, input.commissionAmount) * 100)
  return Math.max(0, rent - Math.min(rent, pending) - commission) / 100
}

export function separatelyBilledExtensionTotal(extensions: {
  uuid: string
  createdAt: string
  addedAmount: number
  cancelled: boolean
}[], mainPaidAt: string | null) {
  if (!mainPaidAt) {
    return 0
  }

  const total = extensions
    .filter(extension => !extension.cancelled && Date.parse(extension.createdAt) > Date.parse(mainPaidAt))
    .reduce((sum, extension) => sum + Math.round(extension.addedAmount * 100), 0)
  return total / 100
}
