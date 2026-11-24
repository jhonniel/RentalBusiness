import { describe, expect, it } from 'vitest'
import { amountDue, amountToPay, rentalSalesBreakdown } from '../../utils/rental'
import { rentalPaymentBalance } from '../../utils/rental-balance'

describe('partial mark-paid balance', () => {
  it('shows rent-only unpaid remainder after a partial booking payment', () => {
    const deposit = 5000
    const rent = 10000
    const paid = 3000
    const balance = rentalPaymentBalance({
      status: 'paid',
      totalAmount: rent,
      depositAmount: deposit,
      payments: [{
        amount: paid,
        status: 'paid',
        paid_at: '2026-11-24T00:00:00.000Z',
        created_at: '2026-11-24T00:00:00.000Z',
        metadata: {
          recordedBy: 'admin',
          includesDeposit: false,
          depositAmount: 0,
          rentAmount: paid,
          partial: true,
          amountDue: rent,
        },
      }],
      extensions: [],
    })

    expect(amountDue({ totalAmount: rent, depositAmount: deposit })).toBe(15000)
    expect(amountToPay({ totalAmount: rent })).toBe(10000)
    // Deposit is not in Balance unpaid — only remaining rent.
    expect(balance).toEqual({
      paidAmount: 3000,
      newAmount: 10000,
      balanceDue: 7000,
      refundDue: 0,
    })

    const sales = rentalSalesBreakdown({
      items: [{
        uuid: 'i',
        quantity: 1,
        dailyPrice: 10000,
        lineTotal: 10000,
        product: { uuid: 'p', slug: 's', name: 'Kit', sku: 'K' },
      }],
      startsOn: '2026-11-24',
      endsOn: '2026-11-24',
      discountAmount: 0,
      totalAmount: rent,
      commissionAmount: 0,
      commissionPerDay: 0,
      commissioner: null,
      paymentBalance: balance,
    } as Parameters<typeof rentalSalesBreakdown>[0])

    expect(sales.pendingBalance).toBe(7000)
    expect(sales.confirmedRent).toBe(3000)
  })
})
