import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type {
  AdminRegisteredDeviceListResponse,
  PublicDeviceLockedPreview,
  PublicDevicePage,
  PublicRegisteredDevice,
} from '../../types/registered-device'
import type { AssignDeviceInput, RegisteredDeviceInput, UnlockDeviceInput } from '../../utils/registered-device-validation'
import {
  createDevicePublicCode,
  isDeviceAssignmentHolding,
  isDevicePublicCode,
  normalizeDevicePublicCode,
  rentalCodeMatchesAssignment,
  toPublicDeviceLockedPreview,
  toPublicDevicePage,
  toPublicRegisteredDevice,
} from '../../utils/registered-device'
import { normalizeSku } from '../../utils/slug'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { getSupabaseAdminClient } from '../utils/supabase'
import { findProductIdByUuid } from '../repositories/product.repository'
import { isRentalCode } from '../../utils/rental'
import { isUuid } from '../../utils/slug'
import { listRentalAddonItems } from '../repositories/addon.repository'
import { findRentalByCode, findRentalIdentity } from '../repositories/rental.repository'
import {
  countAssignmentsByAssetIds,
  findActiveAssignmentForAsset,
  findRegisteredDeviceByPublicCode,
  findRegisteredDeviceByUuid,
  insertAssignment,
  insertRegisteredDevice,
  listActiveAssignmentsForAssets,
  listAssignmentsForRental,
  listBlockingAssignmentsWithRentals,
  listRegisteredDevices,
  REGISTERED_DEVICE_SETUP_MESSAGE,
  releaseAssignmentByUuid,
  releaseAssignmentsForRental,
  rentalHasProductLine,
  updateRegisteredDeviceByUuid,
} from '../repositories/registered-device.repository'

type Client = SupabaseClient<Database>

/** Free devices whose open assignment sits on a past/closed rental window (usage stays counted). */
async function releaseExpiredHoldingAssignments(client: Client) {
  const rows = await listBlockingAssignmentsWithRentals(client)
  const now = new Date()
  for (const row of rows) {
    const rental = Array.isArray(row.rental_requests) ? row.rental_requests[0] : row.rental_requests
    if (isDeviceAssignmentHolding(rental, now)) {
      continue
    }
    await releaseAssignmentByUuid(client, row.uuid, now.toISOString()).catch(() => undefined)
  }
}

function siteOrigin() {
  const config = useRuntimeConfig()
  return String(config.public.siteUrl || process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function sanitizeSearch(value?: string) {
  const trimmed = value?.trim()
  return trimmed || undefined
}

async function mapDevices(
  client: Client,
  rows: Awaited<ReturnType<typeof listRegisteredDevices>>['rows'],
): Promise<PublicRegisteredDevice[]> {
  await releaseExpiredHoldingAssignments(client)
  const assetIds = rows
    .map(row => Number((row as { id?: number }).id || 0))
    .filter(Boolean)
  const [usageCounts, assignments] = await Promise.all([
    countAssignmentsByAssetIds(client, assetIds),
    listActiveAssignmentsForAssets(client, assetIds),
  ])
  const now = new Date()
  const assignmentByAsset = new Map(
    assignments
      .filter((row) => {
        const rental = Array.isArray(row.rental_requests) ? row.rental_requests[0] : row.rental_requests
        return isDeviceAssignmentHolding(rental, now)
      })
      .map(row => [row.equipment_asset_id, row]),
  )

  return rows.map((row) => {
    const id = Number((row as { id?: number }).id || 0)
    return toPublicRegisteredDevice(row, {
      siteUrl: siteOrigin(),
      usageCount: usageCounts.get(id) || 0,
      assignment: assignmentByAsset.get(id) || null,
    })
  })
}

async function loadMappedDevice(client: Client, uuid: string) {
  const row = await findRegisteredDeviceByUuid(client, uuid)
  if (!row) {
    throw new AppError('Device not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  const [mapped] = await mapDevices(client, [row])
  return mapped
}

export async function getAdminRegisteredDevices(
  client: Client,
  query: {
    search?: string
    status?: RegisteredDeviceInput['status']
    productUuid?: string
    uuid?: string
    page: number
    pageSize: number
  },
): Promise<AdminRegisteredDeviceListResponse> {
  let productId: number | undefined
  if (query.productUuid) {
    const product = await findProductIdByUuid(client, query.productUuid)
    if (!product) {
      throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
    }
    productId = product.id
  }

  const from = (query.page - 1) * query.pageSize
  const { rows, total, ready } = await listRegisteredDevices(client, {
    search: sanitizeSearch(query.search),
    status: query.status,
    productId,
    uuid: query.uuid,
    from,
    to: from + query.pageSize - 1,
  })

  if (!ready) {
    return {
      items: [],
      page: query.page,
      pageSize: query.pageSize,
      total: 0,
      ready: false,
    }
  }

  return {
    items: await mapDevices(client, rows),
    page: query.page,
    pageSize: query.pageSize,
    total,
    ready: true,
  }
}

export async function saveRegisteredDevice(
  event: H3Event,
  client: Client,
  input: RegisteredDeviceInput,
  options: { deviceUuid?: string } = {},
) {
  const product = await findProductIdByUuid(client, input.productUuid)
  if (!product) {
    throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const values = {
    product_id: product.id,
    label: input.label,
    asset_code: normalizeSku(input.assetCode),
    serial_number: input.serialNumber,
    condition: input.condition,
    status: input.status,
    bag_pin: input.bagPin,
    wifi_name: input.wifiName,
    wifi_password: input.wifiPassword,
    bag_contents: input.bagContents,
    notes: input.notes,
  }

  let row
  if (options.deviceUuid) {
    row = await updateRegisteredDeviceByUuid(client, options.deviceUuid, values)
  }
  else {
    row = await insertRegisteredDevice(client, {
      ...values,
      public_code: createDevicePublicCode(),
    })
  }

  const device = await loadMappedDevice(client, row.uuid)
  await recordAudit(event, client, {
    action: options.deviceUuid ? 'device.update' : 'device.create',
    entity: 'equipment_assets',
    entityId: device.uuid,
    next: {
      label: device.label,
      assetCode: device.assetCode,
      publicCode: device.publicCode,
      status: device.status,
    },
  })
  return device
}

export async function rotateRegisteredDeviceCode(event: H3Event, client: Client, deviceUuid: string) {
  const existing = await findRegisteredDeviceByUuid(client, deviceUuid)
  if (!existing) {
    throw new AppError('Device not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const previousCode = existing.public_code
  const row = await updateRegisteredDeviceByUuid(client, deviceUuid, {
    public_code: createDevicePublicCode(),
  })
  const device = await loadMappedDevice(client, row.uuid)
  await recordAudit(event, client, {
    action: 'device.rotate_code',
    entity: 'equipment_assets',
    entityId: device.uuid,
    previous: { publicCode: previousCode },
    next: { publicCode: device.publicCode },
  })
  return device
}

export async function assignRegisteredDevice(
  event: H3Event,
  client: Client,
  deviceUuid: string,
  input: AssignDeviceInput,
) {
  const device = await findRegisteredDeviceByUuid(client, deviceUuid)
  if (!device) {
    throw new AppError('Device not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  await releaseExpiredHoldingAssignments(client)

  const active = await findActiveAssignmentForAsset(client, device.id)
  if (active) {
    const rentalOnHold = Array.isArray(active.rental_requests)
      ? active.rental_requests[0]
      : active.rental_requests
    if (isDeviceAssignmentHolding(rentalOnHold)) {
      throw new AppError('That device is already assigned. Release it first.', 409, ERROR_CODES.CONFLICT)
    }
    await releaseAssignmentByUuid(client, active.uuid)
  }

  const rental = await findRentalByCode(client, input.rentalCode)
  if (!rental) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  // Prefer devices whose product is on the rental, but allow extra units (ops tracking, not stock).
  const line = await rentalHasProductLine(client, rental.id, device.product_id)
  if (!line) {
    throw new AppError('This device’s product is not on that rental.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  const nowIso = new Date().toISOString()
  const holdsDevice = isDeviceAssignmentHolding({
    status: rental.status,
    ends_on: rental.ends_on,
    return_at: rental.return_at,
  })

  // Past / finished bookings still get a usage row, but released immediately so the unit stays free.
  await insertAssignment(client, {
    rental_id: rental.id,
    equipment_asset_id: device.id,
    assigned_at: nowIso,
    released_at: holdsDevice ? null : nowIso,
  })

  const mapped = await loadMappedDevice(client, device.uuid)
  await recordAudit(event, client, {
    action: 'device.assign',
    entity: 'rental_asset_assignments',
    entityId: mapped.assignment?.uuid || device.uuid,
    next: {
      deviceUuid: device.uuid,
      rentalCode: rental.code,
      rentalUuid: rental.uuid,
      holding: holdsDevice,
      usageOnly: !holdsDevice,
    },
  })
  return mapped
}

export async function releaseRegisteredDevice(event: H3Event, client: Client, deviceUuid: string) {
  const device = await findRegisteredDeviceByUuid(client, deviceUuid)
  if (!device) {
    throw new AppError('Device not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const active = await findActiveAssignmentForAsset(client, device.id)
  if (!active) {
    throw new AppError('That device is not assigned.', 409, ERROR_CODES.CONFLICT)
  }

  await releaseAssignmentByUuid(client, active.uuid)
  const mapped = await loadMappedDevice(client, device.uuid)
  await recordAudit(event, client, {
    action: 'device.release',
    entity: 'rental_asset_assignments',
    entityId: active.uuid,
    previous: { deviceUuid: device.uuid },
  })
  return mapped
}

export async function getRentalAssignedDevices(client: Client, rentalIdentifier: string) {
  // Do not query uuid with a rental code — Postgres rejects non-uuid strings and the page looked empty.
  const row = isUuid(rentalIdentifier)
    ? await findRentalIdentity(client, rentalIdentifier)
    : isRentalCode(rentalIdentifier)
      ? await findRentalByCode(client, rentalIdentifier)
      : null
  if (!row) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const { rows, ready } = await listAssignmentsForRental(client, row.id)
  if (!ready) {
    return { items: [] as PublicRegisteredDevice[], ready: false }
  }

  // Dedupe by asset — keep latest assignment row for display, include released history for past bookings.
  const byAsset = new Map<number, (typeof rows)[number]>()
  for (const assignment of rows) {
    if (!byAsset.has(assignment.equipment_asset_id)) {
      byAsset.set(assignment.equipment_asset_id, assignment)
    }
  }
  const devices = [...byAsset.values()].flatMap((assignment) => {
    const asset = assignment.equipment_assets
    if (!asset) {
      return []
    }
    return [Array.isArray(asset) ? asset[0] : asset].filter(Boolean)
  })
  const mapped = await mapDevices(client, devices)
  return { items: mapped, ready: true }
}

export async function releaseDevicesForRental(client: Client, rentalId: number) {
  await releaseAssignmentsForRental(client, rentalId)
}

async function loadPublicDeviceRow(code: string) {
  const publicCode = normalizeDevicePublicCode(code)
  if (!isDevicePublicCode(publicCode)) {
    throw new AppError('Device not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const admin = getSupabaseAdminClient()
  let row
  try {
    row = await findRegisteredDeviceByPublicCode(admin, publicCode)
  }
  catch (error) {
    if (error instanceof AppError && (error.statusCode === 409 || error.userMessage === REGISTERED_DEVICE_SETUP_MESSAGE)) {
      throw new AppError('Device not found.', 404, ERROR_CODES.NOT_FOUND)
    }
    throw error
  }

  if (!row) {
    throw new AppError('Device not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  return { admin, row }
}

async function buildUnlockedDevicePage(
  admin: Client,
  row: NonNullable<Awaited<ReturnType<typeof findRegisteredDeviceByPublicCode>>>,
  assignment: NonNullable<Awaited<ReturnType<typeof findActiveAssignmentForAsset>>>,
): Promise<PublicDevicePage> {
  let addonLabels: string[] = []
  if (assignment.rental_id) {
    const addons = await listRentalAddonItems(admin, assignment.rental_id).catch(() => [])
    addonLabels = addons.map((item) => {
      const addon = Array.isArray(item.addons) ? item.addons[0] : item.addons
      const name = String(addon?.name || '').trim()
      if (!name) {
        return ''
      }
      const quantity = Number(item.quantity) || 1
      return quantity > 1 ? `${name} × ${quantity}` : name
    }).filter(Boolean)
  }

  return {
    locked: false,
    ...toPublicDevicePage(row, assignment, { addonLabels }),
  }
}

/** Locked preview only — bag pin / Wi‑Fi stay hidden until booking unlock. */
export async function getPublicRegisteredDevice(code: string): Promise<PublicDeviceLockedPreview> {
  const { row } = await loadPublicDeviceRow(code)
  return toPublicDeviceLockedPreview(row)
}

/**
 * Unlock device details when the entered booking code matches the active assignment
 * on this registered device and that rental is still ongoing.
 */
export async function unlockPublicRegisteredDevice(
  code: string,
  input: UnlockDeviceInput,
): Promise<PublicDevicePage> {
  const { admin, row } = await loadPublicDeviceRow(code)
  await releaseExpiredHoldingAssignments(admin)

  const assignment = await findActiveAssignmentForAsset(admin, row.id)
  if (!assignment || assignment.released_at) {
    throw new AppError(
      'This device isn’t linked to an active booking yet.',
      403,
      ERROR_CODES.FORBIDDEN,
    )
  }

  const rental = Array.isArray(assignment.rental_requests)
    ? assignment.rental_requests[0]
    : assignment.rental_requests

  if (!rental || !isDeviceAssignmentHolding(rental)) {
    throw new AppError(
      'This device isn’t linked to an active booking yet.',
      403,
      ERROR_CODES.FORBIDDEN,
    )
  }

  const entered = input.rentalCode.trim().toUpperCase()
  if (!rentalCodeMatchesAssignment(entered, rental.code)) {
    throw new AppError(
      'That booking code doesn’t match this device.',
      403,
      ERROR_CODES.FORBIDDEN,
    )
  }

  return buildUnlockedDevicePage(admin, row, assignment)
}
