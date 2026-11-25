import type { PublicDeviceLockedPreview, PublicDevicePage, PublicRegisteredDevice } from '~/types/registered-device'
import { BUSINESS_TIMEZONE, CANCELLED_RENTAL_STATUSES, DONE_RENTAL_STATUSES } from './constants'
import type { EquipmentStatus } from './constants'
import { personDisplayName } from './person'
import { rentalCodeCandidates } from './rental'

const HOLDING_CLOSED = new Set<string>([...CANCELLED_RENTAL_STATUSES, ...DONE_RENTAL_STATUSES])

/** True while an assignment should keep the device unavailable for other bookings. */
export function isDeviceAssignmentHolding(
  rental: {
    status?: string | null
    ends_on?: string | null
    endsOn?: string | null
    return_at?: string | null
    returnAt?: string | null
  } | null | undefined,
  now = new Date(),
) {
  if (!rental) {
    return false
  }
  if (rental.status && HOLDING_CLOSED.has(rental.status)) {
    return false
  }

  const returnAt = rental.return_at || rental.returnAt
  if (returnAt) {
    const endMs = Date.parse(returnAt)
    return Number.isFinite(endMs) && endMs > now.getTime()
  }

  const endsOn = rental.ends_on || rental.endsOn
  if (!endsOn) {
    return true
  }

  // Inclusive rental end date in Asia/Manila — free after that local calendar day.
  const localToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return endsOn >= localToday
}

const DEVICE_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const DEVICE_CODE_RE = /^jry-dev-[a-z0-9]{8,16}$/i

export function isDevicePublicCode(value: string) {
  return DEVICE_CODE_RE.test(value.trim())
}

export function normalizeDevicePublicCode(value: string) {
  return value.trim().toLowerCase()
}

export function createDevicePublicCode() {
  let body = ''
  for (let index = 0; index < 10; index += 1) {
    body += DEVICE_CODE_ALPHABET[Math.floor(Math.random() * DEVICE_CODE_ALPHABET.length)]
  }
  return `jry-dev-${body}`
}

export function devicePagePath(code: string) {
  return `/devices/${normalizeDevicePublicCode(code)}`
}

export function parseBagContents(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 40)
}

export interface RegisteredDeviceRow {
  id?: number
  uuid: string
  public_code: string
  label: string | null
  asset_code: string
  serial_number: string | null
  condition: string
  status: EquipmentStatus
  bag_pin: string | null
  wifi_name: string | null
  wifi_password: string | null
  bag_contents: unknown
  notes: string | null
  updated_at: string | null
  products?: {
    uuid: string
    name: string
    sku: string
    included_accessories?: unknown
  } | Array<{
    uuid: string
    name: string
    sku: string
    included_accessories?: unknown
  }> | null
}

export interface DeviceAssignmentRow {
  uuid: string
  assigned_at: string
  released_at: string | null
  rental_requests?: {
    uuid: string
    code: string
    starts_on: string
    ends_on: string
    return_at?: string | null
    status: string
    profiles?: {
      first_name: string | null
      last_name: string | null
    } | Array<{
      first_name: string | null
      last_name: string | null
    }> | null
  } | Array<{
    uuid: string
    code: string
    starts_on: string
    ends_on: string
    return_at?: string | null
    status: string
    profiles?: {
      first_name: string | null
      last_name: string | null
    } | Array<{
      first_name: string | null
      last_name: string | null
    }> | null
  }> | null
}

/** True when the typed booking code matches the rental on the active assignment (JRY/LUM aliases). */
export function rentalCodeMatchesAssignment(enteredCode: string, assignedCode: string | null | undefined) {
  const entered = String(enteredCode || '').trim().toUpperCase()
  const assigned = String(assignedCode || '').trim().toUpperCase()
  if (!entered || !assigned) {
    return false
  }
  const assignedSet = new Set(rentalCodeCandidates(assigned).map(code => code.toUpperCase()))
  return rentalCodeCandidates(entered).some(code => assignedSet.has(code.toUpperCase()))
}

export function toPublicDeviceLockedPreview(row: RegisteredDeviceRow): PublicDeviceLockedPreview {
  const product = productFromRow(row)
  return {
    locked: true,
    label: row.label || product.name,
    productName: product.name,
  }
}

/** Morning / Afternoon / Evening in Asia/Manila. */
export function manilaDayPeriod(now = new Date()): 'Morning' | 'Afternoon' | 'Evening' {
  const hourPart = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now).find(part => part.type === 'hour')?.value
  const hour = Number(hourPart)
  if (!Number.isFinite(hour) || hour < 12) {
    return 'Morning'
  }
  if (hour < 18) {
    return 'Afternoon'
  }
  return 'Evening'
}

/** Manila local greeting parts for UI hierarchy (period + first name). */
export function deviceCustomerGreetingParts(firstName: string | null | undefined, now = new Date()) {
  const period = manilaDayPeriod(now)
  const name = String(firstName || '').trim()
  return {
    period,
    salutation: `Good ${period}`,
    firstName: name || null,
  }
}

/** e.g. "Good Afternoon, Dale" using Manila local time and first name only. */
export function deviceCustomerGreeting(firstName: string | null | undefined, now = new Date()) {
  const parts = deviceCustomerGreetingParts(firstName, now)
  return parts.firstName ? `${parts.salutation}, ${parts.firstName}` : parts.salutation
}

/** Escape SSID / password for WIFI: join URIs (QR / Android). */
function escapeWifiField(value: string) {
  return String(value || '').replace(/([\\;,:"])/g, '\\$1')
}

/** Standard WIFI join URI — Android can open this; iOS usually needs copy + Settings. */
export function wifiJoinUri(ssid: string, password: string, security: 'WPA' | 'WEP' | 'nopass' = 'WPA') {
  const name = escapeWifiField(ssid.trim())
  if (!name) {
    return ''
  }
  const pass = password.trim()
  if (!pass || security === 'nopass') {
    return `WIFI:T:nopass;S:${name};;`
  }
  return `WIFI:T:${security};S:${name};P:${escapeWifiField(pass)};;`
}

function productFromRow(row: RegisteredDeviceRow) {
  const product = Array.isArray(row.products) ? row.products[0] : row.products
  if (!product) {
    throw new Error('Device is missing a product.')
  }
  return product
}

export function resolveBagContents(deviceContents: unknown, productAccessories: unknown) {
  const own = parseBagContents(deviceContents)
  if (own.length) {
    return own
  }
  return parseBagContents(productAccessories)
}

/** Append add-on names to bag contents without duplicates (case-insensitive). */
export function mergeBagContentsWithAddons(base: string[], addonLabels: string[]) {
  const seen = new Set(base.map(item => item.trim().toLowerCase()).filter(Boolean))
  const merged = [...base]
  for (const label of addonLabels) {
    const text = String(label || '').trim()
    if (!text) {
      continue
    }
    const key = text.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    merged.push(text)
  }
  return merged.slice(0, 60)
}

export function toPublicRegisteredDevice(
  row: RegisteredDeviceRow,
  options: {
    siteUrl: string
    usageCount?: number
    assignment?: DeviceAssignmentRow | null
  },
): PublicRegisteredDevice {
  const product = productFromRow(row)
  const assignmentRaw = options.assignment || null
  const rental = assignmentRaw
    ? (Array.isArray(assignmentRaw.rental_requests) ? assignmentRaw.rental_requests[0] : assignmentRaw.rental_requests)
    : null
  const customer = rental?.profiles
    ? (Array.isArray(rental.profiles) ? rental.profiles[0] : rental.profiles)
    : null

  return {
    uuid: row.uuid,
    publicCode: row.public_code,
    pageUrl: `${options.siteUrl.replace(/\/$/, '')}${devicePagePath(row.public_code)}`,
    label: row.label,
    assetCode: row.asset_code,
    serialNumber: row.serial_number,
    condition: row.condition,
    status: row.status,
    bagPin: row.bag_pin,
    wifiName: row.wifi_name,
    wifiPassword: row.wifi_password,
    bagContents: resolveBagContents(row.bag_contents, product.included_accessories),
    notes: row.notes,
    usageCount: options.usageCount ?? 0,
    product: {
      uuid: product.uuid,
      name: product.name,
      sku: product.sku,
      includedAccessories: parseBagContents(product.included_accessories),
    },
    assignment: rental && assignmentRaw && !assignmentRaw.released_at
      ? {
          uuid: assignmentRaw.uuid,
          rentalUuid: rental.uuid,
          rentalCode: rental.code,
          customerName: personDisplayName({
            firstName: customer?.first_name,
            lastName: customer?.last_name,
          }, 'Customer'),
          startsOn: rental.starts_on,
          endsOn: rental.ends_on,
          assignedAt: assignmentRaw.assigned_at,
        }
      : null,
    updatedAt: row.updated_at,
  }
}

export function toPublicDevicePage(
  row: RegisteredDeviceRow,
  assignment?: DeviceAssignmentRow | null,
  options?: { addonLabels?: string[] },
): PublicDevicePage {
  const product = productFromRow(row)
  const rental = assignment
    ? (Array.isArray(assignment.rental_requests) ? assignment.rental_requests[0] : assignment.rental_requests)
    : null
  const customer = rental?.profiles
    ? (Array.isArray(rental.profiles) ? rental.profiles[0] : rental.profiles)
    : null
  const baseContents = resolveBagContents(row.bag_contents, product.included_accessories)

  return {
    label: row.label || product.name,
    assetCode: row.asset_code,
    serialNumber: row.serial_number,
    status: row.status,
    productName: product.name,
    bagPin: row.bag_pin,
    wifiName: row.wifi_name,
    wifiPassword: row.wifi_password,
    bagContents: mergeBagContentsWithAddons(baseContents, options?.addonLabels || []),
    booking: rental && assignment && !assignment.released_at
      ? {
          customerName: personDisplayName({
            firstName: customer?.first_name,
            lastName: customer?.last_name,
          }, 'Customer'),
          customerFirstName: String(customer?.first_name || '').trim() || null,
          rentalCode: rental.code,
          startsOn: rental.starts_on,
          endsOn: rental.ends_on,
          returnAt: rental.return_at || null,
        }
      : null,
  }
}
