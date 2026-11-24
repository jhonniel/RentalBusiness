import { describe, expect, it } from 'vitest'
import { actualSalesOn, rentalSaleDates } from '../../utils/analytics'
import { commissionForPaidRent } from '../../utils/commission'
import { isRefundPayment, paymentKind, toPublicPayment } from '../../utils/payment'
import { paymentPurpose } from '../../utils/receipt'
import { toSalesRows } from '../../utils/report'
import { paidPaymentChange, paymentBalanceMoved, paymentSaleEffect, rentalSalesBreakdown } from '../../utils/rental'
import { mainPaidPayment, paymentHeldDeposit, rentalPaymentBalance } from '../../utils/rental-balance'
import { rentalActualSale } from '../../utils/rental-extension'

const main = {
  amount: 1500,
  status: 'paid',
  paid_at: '2026-11-12T05:29:12.000Z',
  created_at: '2026-11-12T05:29:00.000Z',
  metadata: { recordedBy: 'admin', includesDeposit: true, depositAmount: 500, rentAmount: 1000 },
}
const balancePaid = {
  amount: 1000,
  status: 'paid',
  paid_at: '2026-11-20T02:00:00.000Z',
  created_at: '2026-11-20T02:00:00.000Z',
  metadata: { kind: 'balance', includesDeposit: false },
}
const refundGiven = {
  amount: 1000,
  status: 'refunded',
  paid_at: '2026-11-22T02:00:00.000Z',
  created_at: '2026-11-22T02:00:00.000Z',
  metadata: { kind: 'refund', includesDeposit: false },
}
const booking = { status: 'approved', depositAmount: 500, extensions: [] }

describe('balance and refund on a paid booking', () => {
  it('keeps the extra rent as an unpaid balance and leaves the paid payment alone', () => {
    // Deposit is stripped out: 1500 collected − 500 deposit = 1000 rent paid.
    expect(rentalPaymentBalance({ ...booking, totalAmount: 2000, payments: [main] }))
      .toEqual({ paidAmount: 1000, newAmount: 2000, balanceDue: 1000, refundDue: 0 })
    expect(rentalPaymentBalance({ ...booking, totalAmount: 1000, payments: [main] }))
      .toEqual({ paidAmount: 1000, newAmount: 1000, balanceDue: 0, refundDue: 0 })
  })

  it('closes the balance once it is marked paid', () => {
    expect(rentalPaymentBalance({ ...booking, totalAmount: 2000, payments: [main, balancePaid] }))
      .toEqual({ paidAmount: 2000, newAmount: 2000, balanceDue: 0, refundDue: 0 })
  })

  it('keeps the amount to refund until the refund is marked given', () => {
    const payments = [main, balancePaid]
    expect(rentalPaymentBalance({ ...booking, totalAmount: 1000, payments }))
      .toEqual({ paidAmount: 2000, newAmount: 1000, balanceDue: 0, refundDue: 1000 })
    expect(rentalPaymentBalance({ ...booking, totalAmount: 1000, payments: [...payments, refundGiven] }))
      .toEqual({ paidAmount: 1000, newAmount: 1000, balanceDue: 0, refundDue: 0 })
  })

  it('opens a new balance when the booking grows again after a refund', () => {
    expect(rentalPaymentBalance({ ...booking, totalAmount: 3000, payments: [main, balancePaid, refundGiven] }))
      .toMatchObject({ paidAmount: 1000, newAmount: 3000, balanceDue: 2000, refundDue: 0 })
  })

  it('has nothing open for unpaid or cancelled bookings', () => {
    expect(rentalPaymentBalance({ ...booking, totalAmount: 2000, payments: [] })).toBeNull()
    expect(rentalPaymentBalance({ ...booking, totalAmount: 2000, payments: [{ ...main, status: 'pending' }] })).toBeNull()
    expect(rentalPaymentBalance({ ...booking, status: 'cancelled', totalAmount: 2000, payments: [main] })).toBeNull()
    expect(rentalPaymentBalance({ ...booking, status: 'rejected', totalAmount: 2000, payments: [main] })).toBeNull()
  })

  it('leaves out extensions billed on their own and late fees', () => {
    const extension = { uuid: 'ext-1', added_amount: 1000, created_at: '2026-11-15T00:00:00.000Z', cancelled_at: null }
    const lateFee = { ...balancePaid, amount: 300, metadata: { kind: 'late_fee' } }
    const extensionPaid = { ...balancePaid, metadata: { kind: 'extension', extensionUuid: 'ext-1' } }
    expect(rentalPaymentBalance({ ...booking, totalAmount: 2000, payments: [main, extensionPaid, lateFee], extensions: [extension] }))
      .toEqual({ paidAmount: 1000, newAmount: 1000, balanceDue: 0, refundDue: 0 })
  })

  it('still balances after the deposit was returned', () => {
    const returned = { ...main, amount: 1000, metadata: { ...main.metadata, depositReturnedAt: '2026-11-30T00:00:00.000Z' } }
    expect(rentalPaymentBalance({ ...booking, status: 'completed', totalAmount: 1000, payments: [returned] }))
      .toEqual({ paidAmount: 1000, newAmount: 1000, balanceDue: 0, refundDue: 0 })
    expect(rentalPaymentBalance({ ...booking, status: 'completed', totalAmount: 2000, payments: [returned] }))
      .toMatchObject({ balanceDue: 1000, refundDue: 0 })
  })

  it('never treats a changed deposit as rent to collect or refund', () => {
    expect(rentalPaymentBalance({ ...booking, depositAmount: 1000, totalAmount: 2000, payments: [main] }))
      .toEqual({ paidAmount: 1000, newAmount: 2000, balanceDue: 1000, refundDue: 0 })
    expect(paidPaymentChange({ paidAmount: 1500, includesDeposit: true, heldDeposit: 500, depositAmount: 0, totalAmount: 1000 }))
      .toEqual({ paidAmount: 1000, newAmount: 1000, balanceDue: 0, refundDue: 0 })
    expect(paymentHeldDeposit(main.metadata)).toBe(500)
    expect(paymentHeldDeposit({ includesDeposit: true, depositAmount: 500, depositReturnedAt: '2026-11-30T00:00:00.000Z' })).toBeNull()
    expect(paymentHeldDeposit(null)).toBeNull()
  })

  it('never carries deposit or downpayment in Balance unpaid', () => {
    // Partial cash toward rent+deposit style payment: strip the held deposit out of the balance.
    expect(paidPaymentChange({
      paidAmount: 3000,
      includesDeposit: true,
      heldDeposit: 1000,
      depositAmount: 1000,
      totalAmount: 3100,
    })).toEqual({ paidAmount: 2000, newAmount: 3100, balanceDue: 1100, refundDue: 0 })
    // Rent-only Payment Receive (deposit already deducted from amount to pay).
    expect(paidPaymentChange({
      paidAmount: 3000,
      includesDeposit: false,
      depositAmount: 1000,
      totalAmount: 3100,
    })).toEqual({ paidAmount: 3000, newAmount: 3100, balanceDue: 100, refundDue: 0 })
  })

  it('picks the booking payment, not a balance, extension or refund', () => {
    expect(mainPaidPayment([balancePaid, refundGiven, main])).toBe(main)
    expect(mainPaidPayment([balancePaid, refundGiven])).toBeNull()
  })

  it('knows when the open balance moved', () => {
    const open = { paidAmount: 1500, newAmount: 2500, balanceDue: 1000, refundDue: 0 }
    expect(paymentBalanceMoved(null, open)).toBe(true)
    expect(paymentBalanceMoved(open, { ...open })).toBe(false)
    expect(paymentBalanceMoved(open, { ...open, balanceDue: 0 })).toBe(true)
    expect(paymentBalanceMoved(null, { ...open, balanceDue: 0 })).toBe(false)
  })
})

describe('balance and refund in sales', () => {
  it('names the kind of each payment', () => {
    expect(paymentKind({ kind: 'balance' })).toBe('balance')
    expect(paymentKind({ kind: 'refund' })).toBe('refund')
    expect(paymentKind({ kind: 'something' })).toBe('booking')
    expect(paymentKind(null)).toBe('booking')
    expect(isRefundPayment(refundGiven)).toBe(true)
    expect(isRefundPayment({ status: 'refunded', metadata: {} })).toBe(false)
    expect(isRefundPayment({ status: 'paid', metadata: { kind: 'refund' } })).toBe(false)
    expect(paymentPurpose({ kind: 'balance' })).toBe('balance')
    expect(toPublicPayment({ uuid: 'p', currency: 'PHP', provider: 'shop', payment_method: 'cash', ...balancePaid, status: 'paid' }).kind).toBe('balance')
  })

  it('counts a balance on the day it was paid and takes a refund off on the day it was given', () => {
    const payments = [main, balancePaid, refundGiven].map(payment => ({ ...payment, status: payment.status as 'paid' | 'refunded', rental_id: 51 }))
    const commission = [{ rental_id: 51, amount: 200, status: 'pending', category: 'commission', incurred_on: '2026-11-17' }]

    expect(paymentSaleEffect(main)).toBe(1000)
    expect(paymentSaleEffect(balancePaid)).toBe(1000)
    expect(paymentSaleEffect(refundGiven)).toBe(-1000)
    expect(paymentSaleEffect({ amount: 900, status: 'refunded', metadata: {} })).toBe(0)
    expect(rentalSaleDates(payments).get(51)).toBe('2026-11-12')
    expect(actualSalesOn(payments, commission, '2026-11-12', '2026-11-12')).toBe(800)
    expect(actualSalesOn(payments, commission, '2026-11-20', '2026-11-20')).toBe(1000)
    expect(actualSalesOn(payments, commission, '2026-11-22', '2026-11-22')).toBe(-1000)
    expect(actualSalesOn(payments, commission, '2026-11-01', '2026-11-30')).toBe(800)
  })

  it('holds back the commission for rent that is not paid yet', () => {
    expect(commissionForPaidRent(200, 2000, 1000)).toBe(100)
    expect(commissionForPaidRent(200, 2000, 0)).toBe(200)
    expect(commissionForPaidRent(200, 2000, 2000)).toBe(0)
    expect(commissionForPaidRent(200, 2000, 5000)).toBe(0)
    expect(commissionForPaidRent(300, 2700, 900)).toBe(200)
    expect(commissionForPaidRent(100, 3000, 1000)).toBe(66.67)
    expect(commissionForPaidRent(0, 2000, 1000)).toBe(0)
    expect(commissionForPaidRent(200, 0, 0)).toBe(200)
  })

  it('takes the held-back commission off on the day the balance was paid', () => {
    const paid = { ...main, status: 'paid' as const, rental_id: 51 }
    const unpaid = [{ rental_id: 51, amount: 100, status: 'pending', category: 'commission', incurred_on: '2026-11-17' }]
    expect(actualSalesOn([paid], unpaid, '2026-11-12', '2026-11-12')).toBe(900)

    const settled = [paid, { ...balancePaid, status: 'paid' as const, rental_id: 51, metadata: { kind: 'balance', commissionAmount: 100 } }]
    const full = [{ rental_id: 51, amount: 200, status: 'pending', category: 'commission', incurred_on: '2026-11-17' }]
    expect(actualSalesOn(settled, full, '2026-11-12', '2026-11-12')).toBe(900)
    expect(actualSalesOn(settled, full, '2026-11-20', '2026-11-20')).toBe(900)
    expect(actualSalesOn(settled, full, '2026-11-01', '2026-11-30')).toBe(1800)
    expect(actualSalesOn(settled, [{ ...full[0], amount: 50 }], '2026-11-20', '2026-11-20')).toBe(950)
    expect(actualSalesOn(settled, [{ ...full[0], status: 'void' }], '2026-11-20', '2026-11-20')).toBe(1000)
  })

  it('lists the refund as a negative sales row', () => {
    const rows = toSalesRows([
      { uuid: 'a', currency: 'PHP', payment_method: 'cash', ...main, status: 'paid' },
      { uuid: 'b', currency: 'PHP', payment_method: 'gcash', ...refundGiven, status: 'refunded' },
      { uuid: 'c', currency: 'PHP', payment_method: 'cash', amount: 700, status: 'refunded', paid_at: '2026-11-22T02:00:00.000Z', metadata: {} },
    ], '2026-11-01', '2026-11-30')

    expect(rows.map(row => [row.uuid, row.amount, row.refund ?? false])).toEqual([['a', 1000, false], ['b', -1000, true]])
  })

  it('keeps an unpaid balance out of the booking sale', () => {
    expect(rentalActualSale({ totalAmount: 2000, commissionAmount: 200, payments: [main], extensions: [], pendingBalance: 1000 })).toBe(800)
    const rental = {
      items: [{ uuid: 'i', quantity: 1, dailyPrice: 1000, lineTotal: 2000, product: { uuid: 'p', slug: 's', name: 'Kit', sku: 'K' } }],
      startsOn: '2026-11-28',
      endsOn: '2026-11-30',
      discountAmount: 0,
      totalAmount: 2000,
      commissionAmount: 200,
      commissionPerDay: 100,
      commissioner: { uuid: 'c', firstName: 'A', lastName: 'B' },
      paymentBalance: { paidAmount: 1500, newAmount: 2500, balanceDue: 1000, refundDue: 0 },
    }
    expect(rentalSalesBreakdown(rental as Parameters<typeof rentalSalesBreakdown>[0])).toMatchObject({ rent: 2000, pendingBalance: 1000, pendingRefund: 0, confirmedRent: 1000, shopKeeps: 800 })
  })
})
