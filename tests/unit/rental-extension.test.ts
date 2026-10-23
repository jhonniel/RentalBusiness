import { describe, expect, it } from 'vitest'
import { extensionPaymentStatus, separatelyBilledExtensionTotal } from '../../utils/rental-extension'

describe('extension payments', () => {
  it('keeps an extension on a paid booking unpaid until it has its own payment', () => {
    const base = { extensionUuid: 'ext-1', extensionCreatedAt: '2026-10-23T09:11:00.000Z' }

    expect(extensionPaymentStatus({ ...base, mainPaidAt: '2026-10-20T07:06:00.000Z', paidExtensionUuids: [] })).toBe('unpaid')
    expect(extensionPaymentStatus({ ...base, mainPaidAt: '2026-10-20T07:06:00.000Z', paidExtensionUuids: ['ext-1'] })).toBe('paid')
    expect(extensionPaymentStatus({ ...base, mainPaidAt: null, paidExtensionUuids: [] })).toBe('included')
    expect(extensionPaymentStatus({ ...base, mainPaidAt: '2026-10-24T00:00:00.000Z', paidExtensionUuids: [] })).toBe('included')
  })

  it('leaves extensions added after the booking payment out of that payment', () => {
    const extensions = [
      { uuid: 'a', createdAt: '2026-10-23T09:11:00.000Z', addedAmount: 2000, cancelled: false },
      { uuid: 'b', createdAt: '2026-10-23T10:00:00.000Z', addedAmount: 900, cancelled: true },
      { uuid: 'c', createdAt: '2026-10-19T10:00:00.000Z', addedAmount: 500, cancelled: false },
    ]

    expect(separatelyBilledExtensionTotal(extensions, '2026-10-20T07:06:00.000Z')).toBe(2000)
    expect(separatelyBilledExtensionTotal(extensions, null)).toBe(0)
  })
})
