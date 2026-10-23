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
