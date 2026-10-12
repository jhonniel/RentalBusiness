import type { PublicWaiverAcceptance, PublicWaiverVersion } from '~/types/waiver'
import { formatMoney } from './currency'

export interface WaiverEquipmentItem {
  quantity: number
  product: {
    name: string
    depositAmount?: number | null
    lateFee?: number | null
    replacementValue?: number | null
  }
}

const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/
const MIN_SIGNATURE_LENGTH = 2500
const MAX_SIGNATURE_LENGTH = 250_000

export interface WaiverVersionRow {
  uuid: string
  version: string
  title: string
  body: string
  is_current: boolean
  published_at: string | null
}

interface WaiverAcceptanceVersionRow {
  uuid: string
  version: string
  title: string
  body: string
}

export interface WaiverAcceptanceRow {
  uuid: string
  signer_name: string
  accepted_at: string
  privacy_policy_version?: string | null
  terms_version?: string | null
  signer_email?: string | null
  signer_phone?: string | null
  waiver_versions: WaiverAcceptanceVersionRow | WaiverAcceptanceVersionRow[] | null
}

export function isSignatureDataUrl(value: string): boolean {
  if (value.length < MIN_SIGNATURE_LENGTH || value.length > MAX_SIGNATURE_LENGTH) {
    return false
  }

  return PNG_DATA_URL.test(value)
}

function asVersion(value: WaiverAcceptanceRow['waiver_versions']): WaiverAcceptanceVersionRow {
  const row = Array.isArray(value) ? value[0] : value
  if (!row) {
    throw new Error('Waiver acceptance is missing a version.')
  }
  return row
}

export function toPublicWaiverVersion(row: WaiverVersionRow): PublicWaiverVersion {
  return {
    uuid: row.uuid,
    version: row.version,
    title: row.title,
    body: row.body,
    isCurrent: row.is_current,
    publishedAt: row.published_at,
  }
}

export function toPublicWaiverAcceptance(row: WaiverAcceptanceRow): PublicWaiverAcceptance {
  const version = asVersion(row.waiver_versions)
  return {
    uuid: row.uuid,
    signerName: row.signer_name,
    signerEmail: row.signer_email ?? null,
    signerPhone: row.signer_phone ?? null,
    acceptedAt: row.accepted_at,
    privacyPolicyVersion: row.privacy_policy_version ?? null,
    termsVersion: row.terms_version ?? null,
    version: {
      uuid: version.uuid,
      version: version.version,
      title: version.title,
      body: version.body,
    },
  }
}

export function firstWaiverAcceptance(
  value: WaiverAcceptanceRow | WaiverAcceptanceRow[] | null | undefined,
): PublicWaiverAcceptance | null {
  if (!value) {
    return null
  }

  const row = Array.isArray(value) ? value[0] : value
  return row ? toPublicWaiverAcceptance(row) : null
}

export const WAIVER_LATE_FEE_SCHEDULE = [
  'Late fee: This applies once the equipment is not returned by the agreed return time.',
  `  Less than 6 hours after the return time: ${formatMoney(300)}.`,
  '  6 hours or more, and up to 12 hours, after the return time: half a day of the rented item.',
  '  More than 12 hours after the return time: charged as 1 day of rent.',
].join('\n')

function waiverMoneyLine(label: string, amount: number | null | undefined, suffix = '') {
  if (amount === null || amount === undefined) {
    return `  ${label}: Not listed`
  }

  return `  ${label}: ${formatMoney(amount)}${suffix}`
}

function rentalItemText(item: WaiverEquipmentItem) {
  const slug = 'slug' in item.product && typeof item.product.slug === 'string' ? item.product.slug : ''
  return `${slug} ${item.product.name}`.toLowerCase()
}

export function isStarlinkRentalItem(item: WaiverEquipmentItem) {
  return rentalItemText(item).includes('starlink')
}

export function isDroneRentalItem(item: WaiverEquipmentItem) {
  const text = rentalItemText(item)
  if (isStarlinkRentalItem(item) || text.includes('osmo')) {
    return false
  }

  return text.includes('drone')
    || text.includes('mavic')
    || text.includes('avata')
    || (text.includes('dji') && (text.includes('air') || text.includes('mini')))
}

export function isCameraRentalItem(item: WaiverEquipmentItem) {
  const text = rentalItemText(item)
  if (isDroneRentalItem(item) || isStarlinkRentalItem(item)) {
    return false
  }

  return text.includes('osmo')
    || text.includes('camera')
    || text.includes('sony')
    || text.includes('gopro')
    || text.includes('a7')
}

const RENTED_EQUIPMENT_SECTIONS = [
  { heading: '7. DRONE RENTAL', include: (items: WaiverEquipmentItem[]) => items.some(isDroneRentalItem) },
  { heading: '8. STARLINK MINI', include: (items: WaiverEquipmentItem[]) => items.some(isStarlinkRentalItem) },
  { heading: '9. CAMERA EQUIPMENT', include: (items: WaiverEquipmentItem[]) => items.some(isCameraRentalItem) },
] as const

export function waiverSectionsForRental(body: string, items: WaiverEquipmentItem[]) {
  let next = body
  for (const section of RENTED_EQUIPMENT_SECTIONS) {
    if (section.include(items)) {
      continue
    }

    const heading = section.heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    next = next.replace(new RegExp(`(?:\\r?\\n)${heading}\\r?\\n[\\s\\S]*?(?=\\r?\\n\\d+\\. )`), '')
  }

  return renumberWaiverSections(next.replace(/\n{3,}/g, '\n\n'))
}

function renumberWaiverSections(body: string) {
  const heading = /^(\d+)\. ([A-Z][A-Z0-9 &'/,.-]+)$/
  const lines = body.split('\n')
  const numbers = lines.flatMap((line) => {
    const match = line.match(heading)
    return match ? [Number(match[1])] : []
  })
  const nextNumber = new Map(numbers.map((number, index) => [number, index + 1]))

  return lines.map((line) => {
    const match = line.match(heading)
    if (match) {
      return `${nextNumber.get(Number(match[1]))}. ${match[2]}`
    }

    return line.replace(/\bsection (\d+)\b/g, (full, raw) => {
      const updated = nextNumber.get(Number(raw))
      return updated ? `section ${updated}` : full
    })
  }).join('\n')
}

export interface WaiverTextPart {
  text: string
  bold: boolean
}

export function waiverDisplayLines(body: string): WaiverTextPart[][] {
  return body.split('\n').map((line) => {
    const match = line.match(/^- (.+?)( × \d+)$/)
    if (!match) {
      return [{ text: line, bold: false }]
    }

    return [
      { text: '- ', bold: false },
      { text: match[1], bold: true },
      { text: match[2], bold: false },
    ]
  })
}

export function waiverEquipmentLines(items: WaiverEquipmentItem[], lateFeeSchedule = false): string {
  if (!items.length) {
    return lateFeeSchedule
      ? `- None listed on this rental.\n${WAIVER_LATE_FEE_SCHEDULE}`
      : '- None listed on this rental.'
  }

  const list = items.map((item) => {
    const lines = [`- ${item.product.name} × ${item.quantity}`]
    if (item.product.depositAmount !== undefined) {
      lines.push(waiverMoneyLine('Deposit', item.product.depositAmount))
    }
    if (!lateFeeSchedule && item.product.lateFee !== undefined) {
      lines.push(waiverMoneyLine('Late fee', item.product.lateFee, ' per day'))
    }
    if (item.product.replacementValue !== undefined) {
      lines.push(waiverMoneyLine('Replacement value', item.product.replacementValue))
    }
    return lines.join('\n')
  }).join('\n')

  return lateFeeSchedule ? `${list}\n${WAIVER_LATE_FEE_SCHEDULE}` : list
}

export function adminSignedWaiverPath(identifier: string) {
  return `/admin/rentals/${identifier}/waiver`
}

export function adminSignedWaiverUrl(origin: string, identifier: string) {
  return `${origin.replace(/\/$/, '')}${adminSignedWaiverPath(identifier)}`
}

export function renderWaiverBody(body: string, items: WaiverEquipmentItem[]): string {
  const list = waiverEquipmentLines(items, body.includes('JRY-WAIVER-v1.2'))
  const withEquipment = body.includes('{{RENTAL_EQUIPMENT}}')
    ? body.replaceAll('{{RENTAL_EQUIPMENT}}', list)
    : body.replace(
        /Equipment may include, but is not limited to:\r?\n(?:- .+\r?\n)+/,
        `Equipment on this rental:\n${list}\n`,
      )

  return waiverSectionsForRental(withEquipment, items)
}
