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

function waiverMoneyLine(label: string, amount: number | null | undefined, suffix = '') {
  if (amount === null || amount === undefined) {
    return `  ${label}: Not listed`
  }

  return `  ${label}: ${formatMoney(amount)}${suffix}`
}

export function waiverEquipmentLines(items: WaiverEquipmentItem[]): string {
  if (!items.length) {
    return '- None listed on this rental.'
  }

  return items.map((item) => {
    const lines = [`- ${item.product.name} × ${item.quantity}`]
    if (item.product.depositAmount !== undefined) {
      lines.push(waiverMoneyLine('Deposit', item.product.depositAmount))
    }
    if (item.product.lateFee !== undefined) {
      lines.push(waiverMoneyLine('Late fee', item.product.lateFee, ' per day'))
    }
    if (item.product.replacementValue !== undefined) {
      lines.push(waiverMoneyLine('Replacement value', item.product.replacementValue))
    }
    return lines.join('\n')
  }).join('\n')
}

export function renderWaiverBody(body: string, items: WaiverEquipmentItem[]): string {
  const list = waiverEquipmentLines(items)

  if (body.includes('{{RENTAL_EQUIPMENT}}')) {
    return body.replaceAll('{{RENTAL_EQUIPMENT}}', list)
  }

  return body.replace(
    /Equipment may include, but is not limited to:\r?\n(?:- .+\r?\n)+/,
    `Equipment on this rental:\n${list}\n`,
  )
}
