import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { AddonInput } from '../../utils/addon-validation'
import type { AddonRow, RentalAddonItemRow } from '../../utils/addon'
import { INVENTORY_OCCUPYING_RENTAL_STATUSES } from '../../utils/constants'
import { AppError, ERROR_CODES } from '../utils/errors'
import { getSupabaseAdminClient } from '../utils/supabase'

type Client = SupabaseClient<Database>

const ADDON_SELECT = 'id, uuid, name, description, unit_price, quantity, bookable, status, image_storage_path, updated_at'
const HOLD_STATUSES = ['draft', ...INVENTORY_OCCUPYING_RENTAL_STATUSES] as const

export const ADDON_SETUP_MESSAGE = 'Paste the product add-ons SQL in Supabase to turn on add-ons.'

function table(client: Client) {
  return (client as unknown as SupabaseClient).from('addons')
}

function linksTable(client: Client) {
  return (client as unknown as SupabaseClient).from('product_addon_links')
}

function itemsTable(client: Client) {
  return (client as unknown as SupabaseClient).from('rental_addon_items')
}

export function isMissingAddonTable(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

function failure(message: string, error: { code?: string } | null): never {
  if (isMissingAddonTable(error)) {
    throw new AppError(ADDON_SETUP_MESSAGE, 409, ERROR_CODES.CONFLICT, { cause: error })
  }
  throw new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
}

async function heldByAddonIds(_client: Client, addonIds: number[], exceptRentalId?: number) {
  const held = new Map<number, number>()
  if (!addonIds.length) {
    return held
  }

  // Stock must count every open rental. Customer RLS only sees own rows, so use service role.
  let query = itemsTable(getSupabaseAdminClient())
    .select('addon_id, quantity, rental_id, rental_requests!inner(status)')
    .in('addon_id', addonIds)
    .in('rental_requests.status', [...HOLD_STATUSES])

  if (exceptRentalId) {
    query = query.neq('rental_id', exceptRentalId)
  }

  const { data, error } = await query

  if (isMissingAddonTable(error)) {
    return held
  }
  if (error) {
    throw new AppError('We could not load add-on stock.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  for (const row of data ?? []) {
    const addonId = Number((row as { addon_id: number }).addon_id)
    const quantity = Number((row as { quantity: number }).quantity)
    held.set(addonId, (held.get(addonId) ?? 0) + quantity)
  }
  return held
}

function withStock(rows: AddonRow[], held: Map<number, number>): AddonRow[] {
  return rows.map((row) => {
    const heldQuantity = held.get(Number(row.id)) ?? 0
    return {
      ...row,
      held_quantity: heldQuantity,
      available: Math.max(0, Number(row.quantity) - heldQuantity),
    }
  })
}

export async function listAddons(client: Client, options: { includeArchived?: boolean } = {}): Promise<AddonRow[] | null> {
  let query = table(client)
    .select(ADDON_SELECT)
    .order('name')
    .limit(500)
  if (!options.includeArchived) {
    query = query.eq('status', 'active')
  }

  const { data, error } = await query
  if (isMissingAddonTable(error)) {
    return null
  }
  if (error) {
    throw new AppError('We could not load the add-ons.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  const rows = (data ?? []) as unknown as AddonRow[]
  const held = await heldByAddonIds(client, rows.map(row => Number(row.id)).filter(Boolean))
  return withStock(rows, held)
}

export async function findAddonByUuid(client: Client, uuid: string): Promise<AddonRow | null> {
  const { data, error } = await table(client).select(ADDON_SELECT).eq('uuid', uuid).maybeSingle()
  if (error) {
    failure('We could not load that add-on.', error)
  }
  if (!data) {
    return null
  }
  const row = data as unknown as AddonRow
  const held = await heldByAddonIds(client, [Number(row.id)])
  return withStock([row], held)[0] ?? null
}

export async function createAddon(client: Client, input: AddonInput) {
  const { data, error } = await table(client)
    .insert({
      name: input.name,
      description: input.description || '',
      unit_price: input.unitPrice,
      quantity: input.quantity,
      bookable: input.bookable,
      status: input.status,
    })
    .select(ADDON_SELECT)
    .single()
  if (error || !data) {
    failure('We could not add that add-on.', error)
  }
  const row = data as unknown as AddonRow
  return {
    ...row,
    held_quantity: 0,
    available: Number(row.quantity),
  }
}

export async function updateAddon(client: Client, uuid: string, input: AddonInput) {
  const { data, error } = await table(client)
    .update({
      name: input.name,
      description: input.description || '',
      unit_price: input.unitPrice,
      quantity: input.quantity,
      bookable: input.bookable,
      status: input.status,
    })
    .eq('uuid', uuid)
    .select(ADDON_SELECT)
    .maybeSingle()
  if (error) {
    failure('We could not update that add-on.', error)
  }
  if (!data) {
    throw new AppError('Add-on not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  const row = data as unknown as AddonRow
  const held = await heldByAddonIds(client, [Number(row.id)])
  return withStock([row], held)[0]!
}

export async function archiveAddon(client: Client, uuid: string) {
  const { data, error } = await table(client)
    .update({ status: 'archived', bookable: false })
    .eq('uuid', uuid)
    .select(ADDON_SELECT)
    .maybeSingle()
  if (error) {
    failure('We could not archive that add-on.', error)
  }
  if (!data) {
    throw new AppError('Add-on not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  const row = data as unknown as AddonRow
  const held = await heldByAddonIds(client, [Number(row.id)])
  return withStock([row], held)[0]!
}

export async function updateAddonImagePath(client: Client, uuid: string, imageStoragePath: string | null) {
  const { data, error } = await table(client)
    .update({ image_storage_path: imageStoragePath })
    .eq('uuid', uuid)
    .select(ADDON_SELECT)
    .maybeSingle()
  if (error) {
    failure('We could not update that add-on image.', error)
  }
  if (!data) {
    throw new AppError('Add-on not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  const row = data as unknown as AddonRow
  const held = await heldByAddonIds(client, [Number(row.id)])
  return withStock([row], held)[0]!
}

export async function listLinkedAddonUuidsForProduct(client: Client, productId: number): Promise<string[] | null> {
  const { data, error } = await linksTable(client)
    .select('addons!inner(uuid)')
    .eq('product_id', productId)
  if (isMissingAddonTable(error)) {
    return null
  }
  if (error) {
    throw new AppError('We could not load product add-ons.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }
  return (data ?? []).map((row) => {
    const addon = (row as { addons: { uuid: string } | { uuid: string }[] }).addons
    return Array.isArray(addon) ? addon[0]?.uuid : addon?.uuid
  }).filter((uuid): uuid is string => Boolean(uuid))
}

export async function listLinkedAddonsForProduct(
  client: Client,
  productId: number,
  options: { bookableOnly?: boolean, exceptRentalId?: number } = {},
): Promise<AddonRow[] | null> {
  let query = linksTable(client)
    .select('addons!inner(id, uuid, name, description, unit_price, quantity, bookable, status, image_storage_path, updated_at)')
    .eq('product_id', productId)
    .eq('addons.status', 'active')

  if (options.bookableOnly) {
    query = query.eq('addons.bookable', true)
  }

  const { data, error } = await query
  if (isMissingAddonTable(error)) {
    return null
  }
  if (error) {
    throw new AppError('We could not load product add-ons.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  const rows = (data ?? []).map((row) => {
    const addon = (row as { addons: AddonRow | AddonRow[] }).addons
    return Array.isArray(addon) ? addon[0] : addon
  }).filter((row): row is AddonRow => Boolean(row))

  const held = await heldByAddonIds(
    client,
    rows.map(row => Number(row.id)).filter(Boolean),
    options.exceptRentalId,
  )
  return withStock(rows, held).sort((a, b) => a.name.localeCompare(b.name))
}

export async function replaceProductAddonLinks(client: Client, productId: number, addonUuids: string[]) {
  const unique = [...new Set(addonUuids)]
  let addonIds: number[] = []
  if (unique.length) {
    const { data, error } = await table(client)
      .select('id, uuid')
      .in('uuid', unique)
      .eq('status', 'active')
    if (error) {
      failure('We could not match those add-ons.', error)
    }
    const rows = (data ?? []) as unknown as { id: number, uuid: string }[]
    if (rows.length !== unique.length) {
      throw new AppError('One or more add-ons were not found.', 400, ERROR_CODES.VALIDATION_ERROR)
    }
    addonIds = rows.map(row => row.id)
  }

  const { error: clearError } = await linksTable(client).delete().eq('product_id', productId)
  if (clearError) {
    failure('We could not update product add-ons.', clearError)
  }

  if (!addonIds.length) {
    return [] as string[]
  }

  const { error: insertError } = await linksTable(client).insert(
    addonIds.map(addonId => ({ product_id: productId, addon_id: addonId })),
  )
  if (insertError) {
    failure('We could not link those add-ons.', insertError)
  }

  return listLinkedAddonUuidsForProduct(client, productId) ?? []
}

export async function findAddonsByUuids(
  client: Client,
  uuids: string[],
  options: { exceptRentalId?: number } = {},
): Promise<AddonRow[]> {
  if (!uuids.length) {
    return []
  }
  const { data, error } = await table(client)
    .select(ADDON_SELECT)
    .in('uuid', uuids)
  if (error) {
    failure('We could not load those add-ons.', error)
  }
  const rows = (data ?? []) as unknown as AddonRow[]
  const held = await heldByAddonIds(
    client,
    rows.map(row => Number(row.id)).filter(Boolean),
    options.exceptRentalId,
  )
  return withStock(rows, held)
}

export async function insertRentalAddonItem(client: Client, values: {
  rental_id: number
  addon_id: number
  quantity: number
  unit_price: number
  line_total: number
}) {
  const { data, error } = await itemsTable(client)
    .insert(values)
    .select('uuid, quantity, unit_price, line_total')
    .single()
  if (error || !data) {
    failure('We could not save that add-on on the booking.', error)
  }
  return data
}

export async function deleteRentalAddonItemsByRentalId(client: Client, rentalId: number) {
  const { error } = await itemsTable(client)
    .delete()
    .eq('rental_id', rentalId)
  if (error) {
    failure('We could not update booking add-ons.', error)
  }
}

export async function listRentalAddonItems(client: Client, rentalId: number): Promise<RentalAddonItemRow[]> {
  const { data, error } = await itemsTable(client)
    .select('uuid, quantity, unit_price, line_total, addons(uuid, name, image_storage_path)')
    .eq('rental_id', rentalId)
  if (isMissingAddonTable(error)) {
    return []
  }
  if (error) {
    throw new AppError('We could not load booking add-ons.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }
  return (data ?? []) as unknown as RentalAddonItemRow[]
}
