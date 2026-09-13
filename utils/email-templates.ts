import type { ReceiptSnapshot } from '~/types/receipt'
import { APP_NAME, BUSINESS_ADDRESS, BUSINESS_EMAIL } from './constants'
import { formatMoney } from './currency'
import { formatBusinessDate } from './datetime'
import { escapeHtml } from './email'

function publicOrigin() {
  return String(process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function emailLogoUrl() {
  return `${publicOrigin()}/logo-on-dark.png`
}

function layout(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;background:#f5f5f4;color:#1c1917;font-family:Geist,ui-sans-serif,system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e7e5e4;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#0f1c17;padding:20px 24px;">
              <img src="${escapeHtml(emailLogoUrl())}" alt="${escapeHtml(APP_NAME)}" width="160" height="76" style="display:block;border:0;height:40px;width:auto;">
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px;color:#78716c;font-size:12px;line-height:1.6;">
              ${escapeHtml(APP_NAME)} · ${escapeHtml(BUSINESS_ADDRESS)} · ${escapeHtml(BUSINESS_EMAIL)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function signupConfirmationEmail(input: {
  firstName: string
  confirmUrl: string
}) {
  const html = layout('Confirm your JRY Rentals account', `
    <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.firstName)},</p>
    <p style="margin:0 0 16px;color:#57534e;line-height:1.6;">
      Thanks for creating a JRY Rentals account. Confirm your email address to request cameras, drones, and Starlink from Davao City.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(input.confirmUrl)}" style="display:inline-block;background:#0f1c17;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">
        Confirm my account
      </a>
    </p>
    <p style="margin:0 0 16px;color:#57534e;font-size:14px;line-height:1.6;">
      This link expires after a short time and should be opened in the same browser you used to sign up. If the button does not work, copy this address:
    </p>
    <p style="margin:0 0 16px;color:#325348;font-size:13px;word-break:break-all;">${escapeHtml(input.confirmUrl)}</p>
    <p style="margin:0;color:#78716c;font-size:13px;line-height:1.6;">
      If you did not create this account, you can ignore this email.
    </p>
  `)

  return {
    subject: `Confirm your ${APP_NAME} account`,
    html,
  }
}

export function receiptIssuedEmail(snapshot: ReceiptSnapshot, receiptUrl: string) {
  const items = snapshot.items.map(item => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;">${escapeHtml(item.name)} × ${item.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;text-align:right;">${escapeHtml(formatMoney(item.lineTotal, snapshot.currency))}</td>
    </tr>
  `).join('')

  const html = layout(`Receipt ${snapshot.receiptNumber}`, `
    <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(snapshot.customer.name)},</p>
    <p style="margin:0 0 16px;color:#57534e;">Payment for rental ${escapeHtml(snapshot.rental.code)} is confirmed. Your receipt is ${escapeHtml(snapshot.receiptNumber)}.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
    <p style="margin:16px 0 0;font-weight:600;">Total paid ${escapeHtml(formatMoney(snapshot.amounts.paidAmount, snapshot.currency))}</p>
    <p style="margin:8px 0 0;color:#57534e;font-size:14px;">Deposit ${escapeHtml(formatMoney(snapshot.amounts.depositAmount, snapshot.currency))} is a hold and is not included in this charge.</p>
    <p style="margin:24px 0 0;"><a href="${escapeHtml(receiptUrl)}" style="color:#325348;">View your receipt</a></p>
  `)

  return {
    subject: `${APP_NAME} receipt ${snapshot.receiptNumber}`,
    html,
  }
}

export function rentalReminderEmail(input: {
  type: 'pickup' | 'return'
  customerName: string
  rentalCode: string
  startsOn: string
  endsOn: string
  rentalUrl: string
}) {
  const date = input.type === 'pickup'
    ? formatBusinessDate(input.startsOn)
    : formatBusinessDate(input.endsOn)
  const heading = input.type === 'pickup'
    ? `Pickup reminder for ${input.rentalCode}`
    : `Return reminder for ${input.rentalCode}`
  const copy = input.type === 'pickup'
    ? `Your rental ${input.rentalCode} starts on ${date}. Please bring a valid ID and your signed waiver.`
    : `Your rental ${input.rentalCode} is due back on ${date}. Late returns may incur fees.`

  const html = layout(heading, `
    <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.customerName)},</p>
    <p style="margin:0 0 16px;color:#57534e;">${escapeHtml(copy)}</p>
    <p style="margin:0;"><a href="${escapeHtml(input.rentalUrl)}" style="color:#325348;">Open the rental</a></p>
  `)

  return {
    subject: `${APP_NAME} ${heading}`,
    html,
  }
}

export function rentalSubmittedStaffEmail(input: {
  rentalCode: string
  customerName: string
  customerEmail: string
  customerPhone: string
  startsOn: string
  endsOn: string
  items: { name: string, quantity: number, lineTotal: number }[]
  totalAmount: number
  depositAmount: number
  notes: string | null
  adminUrl: string
}) {
  const items = input.items.map(item => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;">${escapeHtml(item.name)} × ${item.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;text-align:right;">${escapeHtml(formatMoney(item.lineTotal))}</td>
    </tr>
  `).join('')

  const html = layout(`New rental request ${input.rentalCode}`, `
    <p style="margin:0 0 16px;font-size:16px;">A customer submitted a rental request.</p>
    <p style="margin:0 0 8px;color:#57534e;line-height:1.6;">
      <strong>${escapeHtml(input.rentalCode)}</strong><br>
      ${escapeHtml(input.customerName)} · ${escapeHtml(input.customerEmail)}
      ${input.customerPhone ? ` · ${escapeHtml(input.customerPhone)}` : ''}
    </p>
    <p style="margin:0 0 16px;color:#57534e;line-height:1.6;">
      ${escapeHtml(formatBusinessDate(input.startsOn))} – ${escapeHtml(formatBusinessDate(input.endsOn))}
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
    <p style="margin:16px 0 0;font-weight:600;">Rental total ${escapeHtml(formatMoney(input.totalAmount))}</p>
    <p style="margin:8px 0 0;color:#57534e;font-size:14px;">Deposit hold ${escapeHtml(formatMoney(input.depositAmount))}</p>
    ${input.notes ? `<p style="margin:16px 0 0;color:#57534e;font-size:14px;">Notes: ${escapeHtml(input.notes)}</p>` : ''}
    <p style="margin:24px 0 0;"><a href="${escapeHtml(input.adminUrl)}" style="color:#325348;">Open this request</a></p>
  `)

  return {
    subject: `${APP_NAME} new rental request ${input.rentalCode}`,
    html,
  }
}
