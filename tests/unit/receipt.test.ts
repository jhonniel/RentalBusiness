import { describe, expect, it } from 'vitest'
import { emailPayloadHash } from '../../server/utils/email-hash'
import { escapeHtml } from '../../utils/email'
import { receiptIssuedEmail, rentalSubmittedStaffEmail, signupConfirmationEmail } from '../../utils/email-templates'
import { isReceiptNumber, snapshotHasInternalId, toPublicReceipt } from '../../utils/receipt'
import { receiptIdentifierSchema, rentalReminderSchema } from '../../utils/receipt-validation'

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
  })
})
