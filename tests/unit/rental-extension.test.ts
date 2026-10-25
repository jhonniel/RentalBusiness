import { describe, expect, it } from 'vitest'
import { rentalActualSale, extensionPaymentStatus, separatelyBilledExtensionTotal } from '../../utils/rental-extension'

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

describe('rental actual sale', () => {
  const main = { status: 'paid', paid_at: '2026-10-20T05:00:00Z', created_at: '2026-10-20T05:00:00Z', metadata: { recordedBy: 'admin' } }
  const extension = { uuid: 'ext-1', added_amount: 1000, created_at: '2026-10-23T05:00:00Z', cancelled_at: null }

  it('counts a paid extension and takes off the commission', () => {
    expect(rentalActualSale({
      totalAmount: 4600,
      commissionAmount: 500,
      payments: [main, { status: 'paid', paid_at: '2026-10-24T05:00:00Z', created_at: '2026-10-24T05:00:00Z', metadata: { kind: 'extension', extensionUuid: 'ext-1' } }],
      extensions: [extension],
    })).toBe(4100)
  })

  it('leaves out an unpaid extension until it is paid', () => {
    expect(rentalActualSale({ totalAmount: 4600, commissionAmount: 400, payments: [main], extensions: [extension] })).toBe(3200)
  })

  it('is the rent when there is no commission or extension', () => {
    expect(rentalActualSale({ totalAmount: 2000, commissionAmount: 0, payments: [], extensions: [] })).toBe(2000)
  })
})
