import { describe, expect, it } from 'vitest'
import { emailPayloadHash } from '../../server/utils/email-hash'
import { escapeHtml } from '../../utils/email'
import { feedbackRequestEmail, receiptCopyEmail, receiptIssuedEmail, rentalConfirmedEmail, rentalSubmittedStaffEmail, rentalThankYouEmail, signupConfirmationEmail, waiverInviteEmail } from '../../utils/email-templates'
import { buildReceiptStatement, isReceiptNumber, paymentPurpose, receiptAddonItems, receiptBookingBaseRent, receiptBookingWindow, receiptDiscounts, receiptKitDays, receiptKitItems, snapshotHasInternalId, toPublicReceipt } from '../../utils/receipt'
import { receiptEmailSchema, receiptIdentifierSchema, rentalReminderSchema } from '../../utils/receipt-validation'

const snapshot = {
  receiptNumber: '',
  issuedAt: '2026-09-13T00:00:00.000Z',
  currency: 'PHP',
  rental: {
    uuid: '66666666-6666-4666-8666-666666666666',
    code: 'LUM-20260913-00001',
    startsOn: '2026-09-11',
    endsOn: '2026-09-13',
  },
  customer: { name: 'Ana Reyes', email: 'ana@example.com' },
  business: { name: 'Lumen', email: 'hello@lumen.local', phone: null, address: 'Metro Manila' },
  items: [{
    name: 'Sony A7 IV',
    sku: 'CAM-A7IV-001',
    quantity: 1,
    dailyPrice: 3500,
    lineTotal: 10500,
  }],
  amounts: {
    subtotal: 10500,
    depositAmount: 20000,
    totalAmount: 10500,
    paidAmount: 10500,
  },
  payment: {
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    provider: 'sandbox',
    paidAt: '2026-09-13T00:00:00.000Z',
  },
}

describe('receipt validation', () => {
  it('accepts a public receipt number and rejects an internal id', () => {
    expect(isReceiptNumber('RCP-20260913-00001')).toBe(true)
    expect(receiptIdentifierSchema.parse('RCP-20260913-00001')).toBe('RCP-20260913-00001')
    expect(receiptIdentifierSchema.safeParse('9').success).toBe(false)
  })

  it('requires an email address before an acknowledgement receipt can be sent', () => {
    expect(receiptEmailSchema.safeParse({}).success).toBe(false)
    expect(receiptEmailSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
    expect(receiptEmailSchema.parse({ email: ' guest@example.com ' }).email).toBe('guest@example.com')
  })

  it('requires a rental reference for reminders', () => {
    expect(rentalReminderSchema.parse({
      rentalCode: 'LUM-20260913-00001',
      type: 'pickup',
    }).type).toBe('pickup')

    expect(rentalReminderSchema.safeParse({
      type: 'pickup',
      id: 3,
    }).success).toBe(false)
  })
})

describe('receipt mapper', () => {
  it('lists kit items and add-ons separately, including legacy sku Add-on rows', () => {
    expect(receiptKitItems({
      ...snapshot,
      items: [
        snapshot.items[0]!,
        { name: 'Tripod', sku: 'Add-on', quantity: 1, dailyPrice: 200, lineTotal: 200 },
      ],
    }).map(item => item.name)).toEqual(['Sony A7 IV'])
    expect(receiptAddonItems({
      ...snapshot,
      items: [
        snapshot.items[0]!,
        { name: 'Tripod', sku: 'Add-on', quantity: 1, dailyPrice: 200, lineTotal: 200 },
      ],
    })).toEqual([{ name: 'Tripod', quantity: 1, unitPrice: 200, lineTotal: 200 }])
    expect(receiptAddonItems({
      ...snapshot,
      addons: [{ name: 'Light', quantity: 1, unitPrice: 150, lineTotal: 150 }],
    })).toEqual([{ name: 'Light', quantity: 1, unitPrice: 150, lineTotal: 150 }])
  })

  it('never includes internal ids and overlays the public receipt number', () => {
    const receipt = toPublicReceipt({
      uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      receipt_number: 'RCP-20260913-00001',
      issued_at: '2026-09-13T00:00:00.000Z',
      snapshot,
    })

    expect(receipt).not.toHaveProperty('id')
    expect(receipt).not.toHaveProperty('rental_id')
    expect(receipt.receiptNumber).toBe('RCP-20260913-00001')
    expect(receipt.snapshot.receiptNumber).toBe('RCP-20260913-00001')
    expect(snapshotHasInternalId(receipt.snapshot)).toBe(false)
  })
})

describe('receipt statement', () => {
  it('labels payments by what they paid for', () => {
    expect(paymentPurpose({ kind: 'extension' })).toBe('extension')
    expect(paymentPurpose({ kind: 'late_fee' })).toBe('late_fee')
    expect(paymentPurpose({ recordedBy: 'admin' })).toBe('booking')
    expect(paymentPurpose(null)).toBe('booking')
  })

  it('shows the long-stay discount and voucher on the receipt', () => {
    expect(receiptDiscounts({
      startsOn: '2026-10-20',
      endsOn: '2026-10-25',
      discountAmount: 0,
      voucher: null,
      items: [{ dailyPrice: 1000, quantity: 1, lineTotal: 4600 }],
    }, 5)).toEqual({ longStay: 400, voucher: 0, voucherCode: null })
    expect(receiptDiscounts({
      startsOn: '2026-10-20',
      endsOn: '2026-10-22',
      discountAmount: 100,
      voucher: { code: 'JRY-SAVE100' },
      items: [{ dailyPrice: 1000, quantity: 1, lineTotal: 2000 }],
    }, 2)).toEqual({ longStay: 0, voucher: 100, voucherCode: 'JRY-SAVE100' })
  })

  it('counts kit days from the original window before extensions', () => {
    expect(receiptKitDays({
      rental: { startsOn: '2026-10-21', endsOn: '2026-10-25' },
    })).toBe(4)
    expect(receiptBookingWindow({
      startsOn: '2026-10-20',
      endsOn: '2026-10-25',
      extensions: [{
        previousEndsOn: '2026-10-24',
        addedAmount: 1000,
        createdAt: '2026-10-24T14:00:00Z',
      }],
      snapshot: { startsOn: '2026-10-21', endsOn: '2026-10-24' },
    })).toEqual({ startsOn: '2026-10-20', endsOn: '2026-10-24', days: 4 })
    expect(receiptBookingBaseRent({
      itemLineTotals: [4600],
      extensions: [
        { addedAmount: 2000, cancelledAt: '2026-10-24T01:00:00Z' },
        { addedAmount: 1000 },
      ],
    })).toBe(3600)
  })

  it('lists every paid receipt on the booking with the total', () => {
    const statement = buildReceiptStatement([
      { receipt_number: 'RCP-20261024-2', issued_at: '2026-10-24T03:00:00Z', snapshot: {}, payment: { amount: '1000.00', status: 'paid', metadata: { kind: 'extension' } } },
      { receipt_number: 'RCP-20261020-1', issued_at: '2026-10-20T03:00:00Z', snapshot: {}, payment: { amount: 4100, status: 'paid', metadata: {} } },
      { receipt_number: 'RCP-20261026-3', issued_at: '2026-10-26T03:00:00Z', snapshot: { purpose: 'late_fee', description: 'Late fee · Waiver schedule' }, payment: { amount: 300, status: 'paid', metadata: { kind: 'late_fee' } } },
      { receipt_number: 'RCP-20261026-4', issued_at: '2026-10-26T04:00:00Z', snapshot: {}, payment: { amount: 50, status: 'refunded', metadata: {} } },
    ], 'RCP-20261020-1')

    expect(statement.lines.map(line => [line.receiptNumber, line.label, line.amount, line.current])).toEqual([
      ['RCP-20261020-1', 'Booking payment', 4100, true],
      ['RCP-20261024-2', 'Booking extension', 1000, false],
      ['RCP-20261026-3', 'Late fee · Waiver schedule', 300, false],
    ])
    expect(statement.totalPaid).toBe(5400)
  })
})

describe('email templates', () => {
  it('escapes customer content and keeps confirmation hashes stable', () => {
    const html = receiptIssuedEmail({
      ...snapshot,
      customer: { name: '<script>alert(1)</script>', email: 'ana@example.com' },
    }, 'http://localhost:3000/receipts/RCP-20260913-00001').html

    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(escapeHtml('Ana & Co')).toBe('Ana &amp; Co')
    expect(emailPayloadHash('receipt.issued', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'))
      .toBe(emailPayloadHash('receipt.issued', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'))

    const confirm = signupConfirmationEmail({
      firstName: '<script>alert(1)</script>',
      confirmUrl: 'http://localhost:3000/confirm?token_hash=abc&type=signup',
    })
    expect(confirm.subject).toContain('Confirm your')
    expect(confirm.html).toContain('Confirm my account')
    expect(confirm.html).toContain('/logo-on-dark.png')
    expect(confirm.html).toContain('alt="JRY Rentals"')
    expect(confirm.html).toContain('&lt;script&gt;')
    expect(confirm.html).not.toContain('<script>alert(1)</script>')
    expect(confirm.html).toContain('token_hash=abc')

    const staff = rentalSubmittedStaffEmail({
      rentalCode: 'LUM-20260913-00001',
      customerName: '<script>alert(1)</script>',
      customerEmail: 'guest@example.com',
      customerPhone: '09171234567',
      startsOn: '2026-09-13',
      endsOn: '2026-09-14',
      items: [{ name: 'DJI Air 3', quantity: 1, lineTotal: 2800 }],
      totalAmount: 2800,
      depositAmount: 15000,
      notes: 'Pickup at 9am',
      adminUrl: 'http://localhost:3000/admin/rentals/LUM-20260913-00001',
    })
    expect(staff.subject).toContain('LUM-20260913-00001')
    expect(staff.html).toContain('guest@example.com')
    expect(staff.html).toContain('&lt;script&gt;')
    expect(staff.html).not.toContain('<script>alert(1)</script>')
    expect(staff.html).toContain('/admin/rentals/LUM-20260913-00001')

    const invite = waiverInviteEmail({
      customerName: '<script>alert(1)</script>',
      rentalCode: 'LUM-20260913-00001',
      startsOn: '2026-09-13',
      endsOn: '2026-09-14',
      waiverUrl: 'https://jryrentals.online/waivers/sign/11111111-1111-4111-8111-111111111111?token=secret',
    })
    expect(invite.subject).toContain('LUM-20260913-00001')
    expect(invite.html).toContain('Agree and sign the waiver')
    expect(invite.html).toContain('/waivers/sign/11111111-1111-4111-8111-111111111111')
    expect(invite.html).toContain('&lt;script&gt;')
    expect(invite.html).not.toContain('<script>alert(1)</script>')

    const confirmed = rentalConfirmedEmail({
      customerName: '<script>alert(1)</script>',
      rentalCode: 'LUM-20260913-00001',
      equipmentName: 'Sony A7 IV',
      quantity: 1,
      billingUnit: 'day',
      days: 2,
      hours: null,
      pickupAt: '2026-09-13T00:00:00.000Z',
      returnAt: '2026-09-15T00:00:00.000Z',
      rentalUrl: 'https://jryrentals.online/rentals/LUM-20260913-00001',
      siteUrl: 'https://jryrentals.online',
      needsPayment: true,
    })
    expect(confirmed.subject).toContain('LUM-20260913-00001')
    expect(confirmed.html).toContain('Sony A7 IV')
    expect(confirmed.html).toContain('2 day')
    expect(confirmed.html).toContain('facebook.com/jryrentals')
    expect(confirmed.html).toContain('instagram.com/jryrentals')
    expect(confirmed.html).toContain('jryrentals.online')
    expect(confirmed.html).toContain('/rentals/LUM-20260913-00001')
    expect(confirmed.html).not.toContain('₱')
    expect(confirmed.html).not.toContain('PHP')
    expect(confirmed.html).toContain('&lt;script&gt;')
    expect(confirmed.html).not.toContain('<script>alert(1)</script>')

    const thanks = rentalThankYouEmail({
      customerName: '<script>alert(1)</script>',
      rentalCode: 'LUM-20260913-00001',
      products: ['Sony A7 IV'],
      feedbackUrl: 'https://jryrentals.online/feedback/11111111-1111-4111-8111-111111111111?token=secret',
    })
    expect(thanks.subject).toContain('Thank you')
    expect(thanks.html).toContain('Thank you for renting')
    expect(thanks.html).toContain('/feedback/11111111-1111-4111-8111-111111111111')
    expect(thanks.html).toContain('Share your feedback')
    expect(thanks.html).toContain('&lt;script&gt;')
    expect(thanks.html).not.toContain('<script>alert(1)</script>')

    const copy = receiptCopyEmail({
      receiptNumber: 'RCP-20260913-00001',
      issuedAt: '2026-09-13T00:00:00.000Z',
      snapshot: {
        ...snapshot,
        receiptNumber: 'RCP-20260913-00001',
        customer: { name: '<script>alert(1)</script>', email: 'ana@example.com' },
      },
    })
    expect(copy.subject).toContain('RCP-20260913-00001')
    expect(copy.html).toContain('width:58mm')
    expect(copy.html).toContain('Acknowledgement Receipt')
    expect(copy.html).toContain('Received by')
    expect(copy.html).toContain('Jhonniel Ygay')
    expect(copy.html).toContain('&lt;script&gt;')
    expect(copy.html).not.toContain('<script>alert(1)</script>')

    const feedback = feedbackRequestEmail({
      customerName: '<script>alert(1)</script>',
      rentalCode: 'LUM-20260913-00001',
      products: ['Starlink Mini'],
      feedbackUrl: 'https://jryrentals.online/feedback/11111111-1111-4111-8111-111111111111?token=secret',
    })
    expect(feedback.html).toContain('/logo-on-dark.png')
    expect(feedback.html).toContain('/og-feedback.png')
    expect(feedback.html).toContain('How was your rental')
    expect(feedback.html).toContain('&lt;script&gt;')
    expect(feedback.html).not.toContain('<script>alert(1)</script>')
  })
})
