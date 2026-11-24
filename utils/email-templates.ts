import type { PublicReceipt, ReceiptSnapshot } from '~/types/receipt'
import { APP_NAME, BUSINESS_ADDRESS, BUSINESS_EMAIL, FACEBOOK_URL, INSTAGRAM_URL, RECEIPT_RECEIVED_BY } from './constants'
import { formatMoney } from './currency'
import { formatBusinessDate, formatBusinessDateTime } from './datetime'
import { escapeHtml } from './email'
import { RECEIPT_PURPOSE_LABELS, receiptAddonItems, receiptKitItems } from './receipt'

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
  const kitRows = receiptKitItems(snapshot).map(item => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;">${escapeHtml(item.name)} × ${item.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;text-align:right;">${escapeHtml(formatMoney(item.lineTotal, snapshot.currency))}</td>
    </tr>
  `).join('')
  const addons = receiptAddonItems(snapshot)
  const addonRows = addons.length
    ? `<tr><td colspan="2" style="padding:12px 0 4px;color:#78716c;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Add-ons</td></tr>${addons.map(item => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;">${escapeHtml(item.name)} × ${item.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;text-align:right;">${escapeHtml(formatMoney(item.lineTotal, snapshot.currency))}</td>
    </tr>
  `).join('')}`
    : ''

  const html = layout(`Receipt ${snapshot.receiptNumber}`, `
    <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(snapshot.customer.name)},</p>
    <p style="margin:0 0 16px;color:#57534e;">Payment for rental ${escapeHtml(snapshot.rental.code)} is confirmed. Your receipt is ${escapeHtml(snapshot.receiptNumber)}.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${kitRows}${addonRows}</table>
    <p style="margin:16px 0 0;font-weight:600;">Total paid ${escapeHtml(formatMoney(snapshot.amounts.paidAmount, snapshot.currency))}</p>
    <p style="margin:8px 0 0;color:#57534e;font-size:14px;">Deposit ${escapeHtml(formatMoney(snapshot.amounts.depositAmount, snapshot.currency))} is a hold and is not included in this charge.</p>
    <p style="margin:24px 0 0;"><a href="${escapeHtml(receiptUrl)}" style="color:#325348;">View your receipt</a></p>
  `)

  return {
    subject: `${APP_NAME} receipt ${snapshot.receiptNumber}`,
    html,
  }
}

function slipRow(label: string, value: string) {
  return `<tr>
    <td style="padding:3px 6px 3px 0;color:#57534e;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:3px 0;text-align:right;vertical-align:top;">${escapeHtml(value)}</td>
  </tr>`
}

function slipLine(left: string, right: string) {
  return `<tr>
    <td style="padding:4px 6px 4px 0;border-top:1px dashed #d6d3d1;vertical-align:top;">${left}</td>
    <td style="padding:4px 0;border-top:1px dashed #d6d3d1;text-align:right;vertical-align:top;white-space:nowrap;">${right}</td>
  </tr>`
}

export function receiptCopyEmail(receipt: Pick<PublicReceipt, 'receiptNumber' | 'issuedAt' | 'snapshot' | 'statement' | 'business' | 'rental' | 'bookingPeriod' | 'discounts'>) {
  const snapshot = receipt.snapshot
  const business = {
    name: receipt.business?.name || snapshot.business.name || APP_NAME,
    address: receipt.business?.address || snapshot.business.address || BUSINESS_ADDRESS,
    email: receipt.business?.email || snapshot.business.email || BUSINESS_EMAIL,
    phone: receipt.business?.phone || snapshot.business.phone || '',
  }
  const purpose = snapshot.purpose ?? receipt.statement?.lines.find(line => line.current)?.purpose ?? 'booking'
  const purposeLabel = snapshot.description
    || receipt.statement?.lines.find(line => line.current)?.label
    || RECEIPT_PURPOSE_LABELS[purpose]
  const startsOn = receipt.rental?.startsOn || snapshot.rental.startsOn
  const endsOn = receipt.rental?.endsOn || snapshot.rental.endsOn
  /** Kit lines use the original booked window before extensions. */
  const days = receipt.bookingPeriod?.days ?? 0
  const pickup = receipt.rental?.pickupAt
    ? formatBusinessDateTime(receipt.rental.pickupAt)
    : formatBusinessDate(startsOn)
  const returned = receipt.rental?.returnAt
    ? formatBusinessDateTime(receipt.rental.returnAt)
    : formatBusinessDate(endsOn)
  const paid = snapshot.payment.paidAt ? formatBusinessDate(snapshot.payment.paidAt) : 'Paid'
  const money = (amount: number) => escapeHtml(formatMoney(amount, snapshot.currency))
  const website = publicOrigin()
  const websiteLabel = website.replace(/^https?:\/\//, '')
  const facebookLabel = FACEBOOK_URL.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  const kitItems = receiptKitItems(snapshot)
  const addonItems = receiptAddonItems(snapshot)
  const hourly = kitItems.some(item => item.billingUnit === 'hour')

  const extensionLines = (receipt.statement?.lines ?? []).filter(line => line.purpose === 'extension')
  const lateFeeLines = (receipt.statement?.lines ?? []).filter(line => line.purpose === 'late_fee')
  const itemRows = purpose === 'booking'
    ? [
        ...kitItems.map((item) => {
          const detail = item.lineTotal > 0
            ? (item.billingUnit === 'hour' && item.billedHours
                ? `${formatMoney(item.hourlyPrice, snapshot.currency)} / hour × ${item.billedHours} hour${item.billedHours === 1 ? '' : 's'}`
                : `${formatMoney(item.dailyPrice, snapshot.currency)} / day × ${days} day${days === 1 ? '' : 's'}`)
            : ''
          return slipLine(
            `<div style="font-weight:600;">${escapeHtml(item.name)}</div><div style="color:#57534e;">Qty ${item.quantity}</div>`,
            escapeHtml(detail),
          )
        }),
        ...extensionLines.map(line => slipLine(
          `<div style="font-weight:600;">${escapeHtml(line.label)}</div><div style="color:#57534e;">${escapeHtml(formatBusinessDate(line.issuedAt))}</div>`,
          money(line.amount),
        )),
        ...lateFeeLines.map(line => slipLine(
          `<div style="font-weight:600;">${escapeHtml(line.label)}</div><div style="color:#57534e;">${escapeHtml(formatBusinessDate(line.issuedAt))}</div>`,
          money(line.amount),
        )),
        ...(addonItems.length
          ? [
              `<tr><td colspan="2" style="padding:10px 0 2px;color:#78716c;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;border-top:1px dashed #d6d3d1;">Add-ons</td></tr>`,
              ...addonItems.map(item => slipLine(
                `<div style="font-weight:600;">${escapeHtml(item.name)}</div><div style="color:#57534e;">Qty ${item.quantity}</div>`,
                item.lineTotal > 0 ? escapeHtml(formatMoney(item.lineTotal, snapshot.currency)) : '',
              )),
            ]
          : []),
      ].join('')
    : slipLine(
        `<div style="font-weight:600;">${escapeHtml(purposeLabel)}</div><div style="color:#57534e;">${escapeHtml([...kitItems, ...addonItems].map(item => item.name).join(', '))}</div>`,
        money(snapshot.amounts.paidAmount),
      )

  const discountRows = purpose === 'booking' && receipt.discounts
    ? [
        receipt.discounts.longStay > 0
          ? slipRow(hourly ? 'Hourly discount' : 'Long-stay discount', `−${formatMoney(receipt.discounts.longStay, snapshot.currency)}`)
          : '',
        receipt.discounts.voucher > 0
          ? slipRow(
              receipt.discounts.voucherCode ? `Voucher ${receipt.discounts.voucherCode}` : 'Voucher',
              `−${formatMoney(receipt.discounts.voucher, snapshot.currency)}`,
            )
          : '',
      ].join('')
    : ''

  const rentalCode = snapshot.rental.code
  const paymentListLines = purpose === 'booking'
    ? (receipt.statement?.lines ?? []).filter(line => line.purpose !== 'extension' && line.purpose !== 'late_fee')
    : (receipt.statement?.lines ?? [])
  const paymentRows = paymentListLines.map(line => slipLine(
    `<div style="font-weight:600;">${escapeHtml(line.label)}</div><div style="color:#57534e;font-family:ui-monospace,monospace;">${escapeHtml(rentalCode)} · ${escapeHtml(formatBusinessDate(line.issuedAt))}</div>`,
    money(line.amount),
  )).join('')
  const paymentSection = paymentRows
    ? `<tr>
            <td style="padding:8px;border-top:1px dashed #a8a29e;">
              <div style="font-weight:700;">Payments on this booking</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;">
                ${paymentRows}
                <tr>
                  <td style="padding:6px 6px 0 0;border-top:1px solid #a8a29e;font-weight:700;">Total paid</td>
                  <td style="padding:6px 0 0;border-top:1px solid #a8a29e;text-align:right;font-weight:700;">${money(receipt.statement?.totalPaid ?? 0)}</td>
                </tr>
              </table>
            </td>
          </tr>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(`Acknowledgement Receipt ${receipt.receiptNumber}`)}</title>
</head>
<body style="margin:0;background:#f5f5f4;color:#1c1917;font-family:Geist,ui-sans-serif,system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 8px;">
    <tr>
      <td align="center">
        <table role="presentation" width="220" cellpadding="0" cellspacing="0" style="width:58mm;max-width:58mm;background:#ffffff;color:#1c1917;font-size:12px;line-height:1.35;">
          <tr>
            <td align="center" style="padding:8px 8px 10px;border-bottom:1px dashed #a8a29e;">
              <img src="${escapeHtml(`${publicOrigin()}/logo.png?v=12`)}" alt="${escapeHtml(business.name)}" width="120" height="57" style="display:block;margin:0 auto 6px;border:0;width:120px;height:auto;">
              <div style="font-weight:700;">${escapeHtml(business.name)}</div>
              <div style="color:#57534e;">${escapeHtml(business.address || '')}</div>
              <div style="color:#57534e;">${escapeHtml(business.email || '')}${business.phone ? ` · ${escapeHtml(business.phone)}` : ''}</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:10px 8px 4px;">
              <div style="font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Acknowledgement Receipt</div>
              <div style="font-family:ui-monospace,monospace;">${escapeHtml(receipt.receiptNumber)}</div>
              <div style="margin-top:4px;">${escapeHtml(purposeLabel)}</div>
              <div style="color:#57534e;">Issued ${escapeHtml(formatBusinessDate(receipt.issuedAt))}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 8px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;">
                ${slipRow('Rental', snapshot.rental.code)}
                ${slipRow('Customer', snapshot.customer.name)}
                ${slipRow('Pickup', pickup)}
                ${slipRow('Return', returned)}
                ${slipRow('Payment', `${snapshot.payment.provider} · ${paid}`)}
                ${slipRow('Received by', RECEIPT_RECEIVED_BY)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 8px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;">
                ${itemRows}
                ${discountRows}
              </table>
            </td>
          </tr>
          ${paymentSection}
          <tr>
            <td align="center" style="padding:10px 8px;border-top:1px dashed #a8a29e;color:#57534e;">
              <div style="font-weight:600;color:#1c1917;">Thank you for renting with ${escapeHtml(business.name)}!</div>
              <div style="margin-top:8px;"><a href="${escapeHtml(website)}" style="color:#1c1917;text-decoration:none;">${escapeHtml(websiteLabel)}</a></div>
              <div><a href="${escapeHtml(FACEBOOK_URL)}" style="color:#1c1917;text-decoration:none;">${escapeHtml(facebookLabel)}</a></div>
              <div><a href="mailto:${escapeHtml(business.email || '')}" style="color:#1c1917;text-decoration:none;">${escapeHtml(business.email || '')}</a></div>
              ${business.phone ? `<div>${escapeHtml(business.phone)}</div>` : ''}
              <div style="margin-top:8px;">Keep this receipt for your records.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return {
    subject: `${APP_NAME} acknowledgement receipt ${receipt.receiptNumber}`,
    html,
  }
}

export function rentalConfirmedEmail(input: {
  customerName: string
  rentalCode: string
  equipmentName: string
  quantity: number
  billingUnit: 'day' | 'hour'
  days: number
  hours: number | null
  pickupAt: string
  returnAt: string
  rentalUrl: string
  siteUrl: string
  needsPayment?: boolean
}) {
  const website = input.siteUrl.replace(/\/$/, '') || publicOrigin()
  const websiteLabel = website.replace(/^https?:\/\//, '')
  const facebookLabel = FACEBOOK_URL.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  const instagramLabel = INSTAGRAM_URL.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  const duration = input.billingUnit === 'hour' && input.hours
    ? `${input.hours} hour${input.hours === 1 ? '' : 's'}`
    : `${input.days} day${input.days === 1 ? '' : 's'}`
  const nextStep = input.needsPayment
    ? 'You can open your booking to pay the down payment when you are ready.'
    : 'We will prepare your kit for pickup. Bring a valid ID when you collect it.'

  const html = layout(`Booking confirmed · ${input.rentalCode}`, `
    <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.customerName)},</p>
    <p style="margin:0 0 16px;color:#57534e;line-height:1.6;">
      ${escapeHtml(APP_NAME)} confirmed your booking
      <strong>${escapeHtml(input.rentalCode)}</strong>. Here are the details:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6;">
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;color:#57534e;width:38%;">Equipment</td>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;font-weight:600;">${escapeHtml(input.equipmentName)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;color:#57534e;">Quantity</td>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;">${input.quantity}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;color:#57534e;">Duration</td>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;">${escapeHtml(duration)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;color:#57534e;">Pickup</td>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;">${escapeHtml(formatBusinessDateTime(input.pickupAt))}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;color:#57534e;">Return</td>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;">${escapeHtml(formatBusinessDateTime(input.returnAt))}</td>
      </tr>
    </table>
    <p style="margin:16px 0 0;color:#57534e;line-height:1.6;">${escapeHtml(nextStep)}</p>
    <p style="margin:24px 0 0;">
      <a href="${escapeHtml(input.rentalUrl)}" style="display:inline-block;background:#0f1c17;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">
        Open your booking
      </a>
    </p>
    <p style="margin:24px 0 0;color:#57534e;font-size:14px;line-height:1.7;">
      Website:
      <a href="${escapeHtml(website)}" style="color:#325348;text-decoration:none;">${escapeHtml(websiteLabel)}</a><br>
      Facebook:
      <a href="${escapeHtml(FACEBOOK_URL)}" style="color:#325348;text-decoration:none;">${escapeHtml(facebookLabel)}</a><br>
      Instagram:
      <a href="${escapeHtml(INSTAGRAM_URL)}" style="color:#325348;text-decoration:none;">${escapeHtml(instagramLabel)}</a>
    </p>
  `)

  return {
    subject: `${APP_NAME} booking confirmed · ${input.rentalCode}`,
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

export function waiverInviteEmail(input: {
  customerName: string
  rentalCode: string
  startsOn: string
  endsOn: string
  waiverUrl: string
}) {
  const html = layout(`Sign the rental waiver for ${input.rentalCode}`, `
    <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.customerName)},</p>
    <p style="margin:0 0 16px;color:#57534e;line-height:1.6;">
      JRY Rentals prepared rental ${escapeHtml(input.rentalCode)} for
      ${escapeHtml(formatBusinessDate(input.startsOn))} to ${escapeHtml(formatBusinessDate(input.endsOn))}.
      Open the link to read the Equipment Rental Agreement and sign it.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(input.waiverUrl)}" style="display:inline-block;background:#0f1c17;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">
        Agree and sign the waiver
      </a>
    </p>
    <p style="margin:0 0 16px;color:#57534e;font-size:14px;line-height:1.6;">
      If the button does not work, copy this address:
    </p>
    <p style="margin:0;color:#325348;font-size:13px;word-break:break-all;">${escapeHtml(input.waiverUrl)}</p>
  `)

  return {
    subject: `Sign the ${APP_NAME} waiver for ${input.rentalCode}`,
    html,
  }
}

export function feedbackRequestEmail(input: {
  customerName: string
  rentalCode: string
  products: string[]
  feedbackUrl: string
}) {
  const gear = input.products.length ? input.products.join(', ') : 'your rental'
  const html = layout(`How was ${gear}?`, `
    <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.customerName)},</p>
    <p style="margin:0 0 16px;color:#57534e;line-height:1.6;">
      Thank you for renting ${escapeHtml(gear)} with ${escapeHtml(APP_NAME)} (booking ${escapeHtml(input.rentalCode)}).
      Please rate your experience from 1 to 5 stars and leave a comment. It takes about a minute.
    </p>
    <p style="margin:0 0 20px;">
      <img src="${escapeHtml(`${publicOrigin()}/og-feedback.png`)}" alt="JRY Rentals feedback page: How was your rental, with star ratings" width="512" height="269" style="display:block;width:100%;max-width:512px;height:auto;border:1px solid #e7e5e4;border-radius:12px;">
    </p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(input.feedbackUrl)}" style="display:inline-block;background:#0f1c17;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">
        Rate your rental
      </a>
    </p>
    <p style="margin:0 0 16px;color:#57534e;font-size:14px;line-height:1.6;">
      If the button does not work, copy this address:
    </p>
    <p style="margin:0;color:#325348;font-size:13px;word-break:break-all;">${escapeHtml(input.feedbackUrl)}</p>
  `)

  return {
    subject: `How was your ${APP_NAME} rental? (${input.rentalCode})`,
    html,
  }
}

export function rentalThankYouEmail(input: {
  customerName: string
  rentalCode: string
  products: string[]
  feedbackUrl: string
}) {
  const gear = input.products.length ? input.products.join(', ') : 'your rental'
  const html = layout(`Thank you for renting with ${APP_NAME}`, `
    <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.customerName)},</p>
    <p style="margin:0 0 16px;color:#57534e;line-height:1.6;">
      Thank you for renting ${escapeHtml(gear)} with ${escapeHtml(APP_NAME)}.
      Booking <strong>${escapeHtml(input.rentalCode)}</strong> is marked returned, and we hope everything went well.
    </p>
    <p style="margin:0 0 16px;color:#57534e;line-height:1.6;">
      We would love a quick rating when you have a minute. It helps us keep the kit and service sharp for your next shoot.
    </p>
    <p style="margin:0 0 20px;">
      <img src="${escapeHtml(`${publicOrigin()}/og-feedback.png`)}" alt="JRY Rentals feedback page: How was your rental, with star ratings" width="512" height="269" style="display:block;width:100%;max-width:512px;height:auto;border:1px solid #e7e5e4;border-radius:12px;">
    </p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(input.feedbackUrl)}" style="display:inline-block;background:#0f1c17;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">
        Share your feedback
      </a>
    </p>
    <p style="margin:0 0 16px;color:#57534e;font-size:14px;line-height:1.6;">
      If the button does not work, copy this address:
    </p>
    <p style="margin:0;color:#325348;font-size:13px;word-break:break-all;">${escapeHtml(input.feedbackUrl)}</p>
  `)

  return {
    subject: `Thank you for renting with ${APP_NAME} · ${input.rentalCode}`,
    html,
  }
}

export function feedbackRewardEmail(input: {
  rentalCode: string
  code: string
  label: string
  minSubtotal: number
  endsOn: string | null
}) {
  const terms = [
    input.endsOn ? `Valid until ${formatBusinessDate(input.endsOn)}.` : null,
    input.minSubtotal > 0 ? `For rentals of ${formatMoney(input.minSubtotal)} or more.` : null,
    'Save this email or take a screenshot so you can use the code on your next rental.',
  ].filter(Boolean).join(' ')
  const html = layout('Your thank-you voucher', `
    <p style="margin:0 0 16px;font-size:16px;">Thank you for your feedback on booking ${escapeHtml(input.rentalCode)}!</p>
    <p style="margin:0 0 16px;color:#57534e;line-height:1.6;">Here is your voucher for ${escapeHtml(input.label)}:</p>
    <p style="margin:0 0 16px;">
      <span style="display:inline-block;border:2px dashed #0f1c17;border-radius:10px;padding:12px 20px;font-size:22px;font-weight:700;letter-spacing:2px;color:#0f1c17;">${escapeHtml(input.code)}</span>
    </p>
    <p style="margin:0 0 16px;color:#57534e;font-size:14px;line-height:1.6;">
      This code is only for you and works once. Enter it on the Request a rental page before you pay. ${escapeHtml(terms)}
    </p>
  `)

  return {
    subject: `Your ${APP_NAME} thank-you voucher: ${input.code}`,
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
    <p style="margin:8px 0 0;color:#57534e;font-size:14px;">Deposit ${escapeHtml(formatMoney(input.depositAmount))} is collected with the rent and leaves sales when the rental is finished.</p>
    ${input.notes ? `<p style="margin:16px 0 0;color:#57534e;font-size:14px;">Notes: ${escapeHtml(input.notes)}</p>` : ''}
    <p style="margin:24px 0 0;"><a href="${escapeHtml(input.adminUrl)}" style="color:#325348;">Open this request</a></p>
  `)

  return {
    subject: `${APP_NAME} new rental request ${input.rentalCode}`,
    html,
  }
}
