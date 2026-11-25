import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { EquipmentStatus } from '../../utils/constants'
import type { DeviceAssignmentRow, RegisteredDeviceRow } from '../../utils/registered-device'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const DEVICE_SELECT = `
  id,
  uuid,
  public_code,
  label,
  asset_code,
  serial_number,
  condition,
  status,
  bag_pin,
  wifi_name,
  wifi_password,
  bag_contents,
  notes,
  updated_at,
  product_id,
  products (
    uuid,
    name,
    sku,
    included_accessories
  )
`

const ASSIGNMENT_SELECT = `
  uuid,
  assigned_at,
  released_at,
  equipment_asset_id,
  rental_id,
  rental_requests (
    uuid,
    code,
    starts_on,
    ends_on,
    return_at,
    status,
    profiles!rental_requests_customer_id_fkey (
      first_name,
      last_name
    )
  )
`

export const REGISTERED_DEVICE_SETUP_MESSAGE
  = 'Paste the registered devices SQL in Supabase to turn on Registered Devices.'

function isMissingColumn(error: { code?: string, message?: string } | null) {
  return error?.code === '42703'
    || error?.code === 'PGRST204'
    || Boolean(error?.message?.includes('public_code'))
}

function isMissingTable(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

function failure(message: string, error: { code?: string, message?: string } | null): never {
  if (isMissingColumn(error) || isMissingTable(error)) {
    throw new AppError(REGISTERED_DEVICE_SETUP_MESSAGE, 409, ERROR_CODES.CONFLICT, { cause: error })
  }
  if (error?.code === '23505') {
    throw new AppError('That asset code or QR code is already in use.', 409, ERROR_CODES.CONFLICT, { cause: error })
  }
  throw new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
}

export function isRegisteredDevicesReadyError(error: { code?: string, message?: string } | null) {
  return isMissingColumn(error) || isMissingTable(error)
}

export async function listRegisteredDevices(client: Client, filters: {
  search?: string
  status?: EquipmentStatus
  productId?: number
  uuid?: string
  from: number
  to: number
}) {
  let query = client
    .from('equipment_assets')
    .select(DEVICE_SELECT, { count: 'exact' })
    .order('label', { ascending: true, nullsFirst: false })
    .order('asset_code')
    .range(filters.from, filters.to)

  if (filters.uuid) {
    query = query.eq('uuid', filters.uuid)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.productId) {
    query = query.eq('product_id', filters.productId)
  }
  if (filters.search) {
    const term = filters.search.replace(/[%_,]/g, '')
    query = query.or(
      `label.ilike.%${term}%,asset_code.ilike.%${term}%,serial_number.ilike.%${term}%,public_code.ilike.%${term}%`,
    )
  }

  const { data, error, count } = await query
  if (isRegisteredDevicesReadyError(error)) {
    return { rows: [] as RegisteredDeviceRow[], total: 0, ready: false as const }
  }
  if (error) {
    throw new AppError('We could not load registered devices.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return {
    rows: (data ?? []) as unknown as RegisteredDeviceRow[],
    total: count ?? 0,
    ready: true as const,
  }
}

export async function findRegisteredDeviceByUuid(client: Client, uuid: string) {
  const { data, error } = await client
    .from('equipment_assets')
    .select(DEVICE_SELECT)
    .eq('uuid', uuid)
    .maybeSingle()

  if (isRegisteredDevicesReadyError(error)) {
    failure(REGISTERED_DEVICE_SETUP_MESSAGE, error)
  }
  if (error) {
    throw new AppError('We could not load that device.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }
  return data as unknown as (RegisteredDeviceRow & { id: number, product_id: number }) | null
}

export async function findRegisteredDeviceByPublicCode(client: Client, publicCode: string) {
  const { data, error } = await client
    .from('equipment_assets')
    .select(DEVICE_SELECT)
    .eq('public_code', publicCode)
    .maybeSingle()

  if (isRegisteredDevicesReadyError(error)) {
    failure(REGISTERED_DEVICE_SETUP_MESSAGE, error)
  }
  if (error) {
    throw new AppError('We could not load that device.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }
  return data as unknown as (RegisteredDeviceRow & { id: number, product_id: number }) | null
}

export async function insertRegisteredDevice(
  client: Client,
  values: Database['public']['Tables']['equipment_assets']['Insert'],
) {
  const { data, error } = await client
    .from('equipment_assets')
    .insert(values)
    .select(DEVICE_SELECT)
    .single()

  if (error || !data) {
    failure('We could not save that device.', error)
  }
  return data as unknown as RegisteredDeviceRow & { id: number, product_id: number }
}

export async function updateRegisteredDeviceByUuid(
  client: Client,
  uuid: string,
  values: Database['public']['Tables']['equipment_assets']['Update'],
) {
  const { data, error } = await client
    .from('equipment_assets')
    .update(values)
    .eq('uuid', uuid)
    .select(DEVICE_SELECT)
    .single()

  if (error || !data) {
    failure('We could not update that device.', error)
  }
  return data as unknown as RegisteredDeviceRow & { id: number, product_id: number }
}

export async function countAssignmentsByAssetIds(client: Client, assetIds: number[]) {
  const counts = new Map<number, number>()
  if (!assetIds.length) {
    return counts
  }

  const { data, error } = await client
    .from('rental_asset_assignments')
    .select('equipment_asset_id')
    .in('equipment_asset_id', assetIds)

  if (isRegisteredDevicesReadyError(error)) {
    return counts
  }
  if (error) {
    throw new AppError('We could not load device usage.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  for (const row of data ?? []) {
    const id = Number((row as { equipment_asset_id: number }).equipment_asset_id)
    counts.set(id, (counts.get(id) || 0) + 1)
  }
  return counts
}

export async function listActiveAssignmentsForAssets(client: Client, assetIds: number[]) {
  if (!assetIds.length) {
    return [] as Array<DeviceAssignmentRow & { equipment_asset_id: number, rental_id: number }>
  }

  const { data, error } = await client
    .from('rental_asset_assignments')
    .select(ASSIGNMENT_SELECT)
    .in('equipment_asset_id', assetIds)
    .is('released_at', null)

  if (isRegisteredDevicesReadyError(error)) {
    return []
  }
  if (error) {
    throw new AppError('We could not load device assignments.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return (data ?? []) as unknown as Array<DeviceAssignmentRow & { equipment_asset_id: number, rental_id: number }>
}

type AssignmentWithAsset = DeviceAssignmentRow & {
  equipment_asset_id: number
  rental_id: number
  equipment_assets: (RegisteredDeviceRow & { id: number, product_id: number }) | null
}

function mapLegacyAssignmentRows(data: unknown[] | null): AssignmentWithAsset[] {
  return ((data ?? []) as Array<Record<string, unknown>>).map(row => ({
    uuid: String(row.uuid),
    assigned_at: String(row.assigned_at || row.created_at || new Date().toISOString()),
    released_at: (row.released_at as string | null | undefined) ?? null,
    equipment_asset_id: Number(row.equipment_asset_id),
    rental_id: Number(row.rental_id),
    equipment_assets: (Array.isArray(row.equipment_assets)
      ? row.equipment_assets[0]
      : row.equipment_assets) as AssignmentWithAsset['equipment_assets'],
  }))
}

/** All assignments for a rental (active + history) so past bookings keep their usage record visible. */
export async function listAssignmentsForRental(client: Client, rentalId: number) {
  const nested = await client
    .from('rental_asset_assignments')
    .select(`${ASSIGNMENT_SELECT}, equipment_assets (${DEVICE_SELECT})`)
    .eq('rental_id', rentalId)
    .order('assigned_at', { ascending: false })

  if (!nested.error) {
    return {
      rows: (nested.data ?? []) as unknown as AssignmentWithAsset[],
      ready: true as const,
    }
  }

  if (isRegisteredDevicesReadyError(nested.error)) {
    const legacy = await client
      .from('rental_asset_assignments')
      .select(`uuid, equipment_asset_id, rental_id, created_at, equipment_assets (${DEVICE_SELECT})`)
      .eq('rental_id', rentalId)

    if (isRegisteredDevicesReadyError(legacy.error)) {
      return { rows: [] as AssignmentWithAsset[], ready: false as const }
    }
    if (legacy.error) {
      throw new AppError('We could not load assigned devices.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: legacy.error })
    }

    return {
      rows: mapLegacyAssignmentRows(legacy.data as unknown[] | null),
      ready: true as const,
    }
  }

  throw new AppError('We could not load assigned devices.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: nested.error })
}

export async function listActiveAssignmentsForRental(client: Client, rentalId: number) {
  const nested = await client
    .from('rental_asset_assignments')
    .select(`${ASSIGNMENT_SELECT}, equipment_assets (${DEVICE_SELECT})`)
    .eq('rental_id', rentalId)
    .is('released_at', null)

  if (!nested.error) {
    return {
      rows: (nested.data ?? []) as unknown as AssignmentWithAsset[],
      ready: true as const,
    }
  }

  if (isRegisteredDevicesReadyError(nested.error)) {
    const all = await listAssignmentsForRental(client, rentalId)
    return {
      rows: all.rows.filter(row => !row.released_at),
      ready: all.ready,
    }
  }

  throw new AppError('We could not load assigned devices.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: nested.error })
}

/** Active assignments whose rental window is already over — free the devices for new bookings. */
export async function listBlockingAssignmentsWithRentals(client: Client) {
  const { data, error } = await client
    .from('rental_asset_assignments')
    .select(`
      uuid,
      equipment_asset_id,
      rental_id,
      assigned_at,
      released_at,
      rental_requests (
        uuid,
        code,
        status,
        starts_on,
        ends_on,
        return_at
      )
    `)
    .is('released_at', null)

  if (isRegisteredDevicesReadyError(error)) {
    return [] as Array<DeviceAssignmentRow & {
      equipment_asset_id: number
      rental_id: number
      rental_requests: {
        uuid: string
        code: string
        status: string
        starts_on: string
        ends_on: string
        return_at: string | null
      } | null
    }>
  }
  if (error) {
    throw new AppError('We could not load device assignments.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return (data ?? []) as unknown as Array<DeviceAssignmentRow & {
    equipment_asset_id: number
    rental_id: number
    rental_requests: {
      uuid: string
      code: string
      status: string
      starts_on: string
      ends_on: string
      return_at: string | null
    } | Array<{
      uuid: string
      code: string
      status: string
      starts_on: string
      ends_on: string
      return_at: string | null
    }> | null
  }>
}

export async function findActiveAssignmentForAsset(client: Client, assetId: number) {
  const { data, error } = await client
    .from('rental_asset_assignments')
    .select(ASSIGNMENT_SELECT)
    .eq('equipment_asset_id', assetId)
    .is('released_at', null)
    .maybeSingle()

  if (isRegisteredDevicesReadyError(error)) {
    failure(REGISTERED_DEVICE_SETUP_MESSAGE, error)
  }
  if (error) {
    throw new AppError('We could not load that assignment.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }
  return data as unknown as (DeviceAssignmentRow & { equipment_asset_id: number, rental_id: number }) | null
}

export async function insertAssignment(client: Client, values: {
  rental_id: number
  equipment_asset_id: number
  assigned_at?: string
  released_at?: string | null
}) {
  const { data, error } = await client
    .from('rental_asset_assignments')
    .insert(values)
    .select(ASSIGNMENT_SELECT)
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      throw new AppError('That device is already assigned to a rental.', 409, ERROR_CODES.CONFLICT, { cause: error })
    }
    failure('We could not assign that device.', error)
  }
  return data as unknown as DeviceAssignmentRow & { equipment_asset_id: number, rental_id: number }
}

export async function releaseAssignmentByUuid(client: Client, uuid: string, releasedAt = new Date().toISOString()) {
  const { data, error } = await client
    .from('rental_asset_assignments')
    .update({ released_at: releasedAt })
    .eq('uuid', uuid)
    .is('released_at', null)
    .select(ASSIGNMENT_SELECT)
    .single()

  if (error || !data) {
    failure('We could not release that device.', error)
  }
  return data as unknown as DeviceAssignmentRow
}

export async function releaseAssignmentsForRental(client: Client, rentalId: number, releasedAt = new Date().toISOString()) {
  const { error } = await client
    .from('rental_asset_assignments')
    .update({ released_at: releasedAt })
    .eq('rental_id', rentalId)
    .is('released_at', null)

  if (isRegisteredDevicesReadyError(error)) {
    return
  }
  if (error) {
    throw new AppError('We could not release assigned devices.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }
}

export async function rentalHasProductLine(client: Client, rentalId: number, productId: number) {
  const { data, error } = await client
    .from('rental_items')
    .select('id, quantity, product_id')
    .eq('rental_id', rentalId)
    .eq('product_id', productId)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not check rental products.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }
  return data
}

export async function countActiveAssignmentsByRentalIds(client: Client, rentalIds: number[]) {
  const counts = new Map<number, number>()
  if (!rentalIds.length) {
    return counts
  }

  const { data, error } = await client
    .from('rental_asset_assignments')
    .select('rental_id')
    .in('rental_id', rentalIds)
    .is('released_at', null)

  if (isRegisteredDevicesReadyError(error)) {
    return counts
  }
  if (error) {
    throw new AppError('We could not load assigned devices.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  for (const row of data ?? []) {
    const id = Number((row as { rental_id: number }).rental_id)
    counts.set(id, (counts.get(id) || 0) + 1)
  }
  return counts
}

export async function countActiveAssignmentsForRentalProduct(
  client: Client,
  rentalId: number,
  productId: number,
) {
  const { data, error } = await client
    .from('rental_asset_assignments')
    .select('uuid, equipment_assets!inner(product_id)')
    .eq('rental_id', rentalId)
    .is('released_at', null)
    .eq('equipment_assets.product_id', productId)

  if (isRegisteredDevicesReadyError(error)) {
    return 0
  }
  if (error) {
    throw new AppError('We could not count assigned devices.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }
  return (data ?? []).length
}
