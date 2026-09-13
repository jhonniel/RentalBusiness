import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { EquipmentStatus } from '../../utils/constants'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const ASSET_SELECT = `
  uuid,
  asset_code,
  serial_number,
  condition,
  status,
  purchase_cost,
  purchase_date,
  replacement_value,
  notes,
  products (
    uuid,
    name,
    sku
  )
`

export async function listAssets(client: Client, filters: {
  search?: string
  status?: EquipmentStatus
  productId?: number
  from: number
  to: number
}) {
  let query = client
    .from('equipment_assets')
    .select(ASSET_SELECT, { count: 'exact' })
    .order('asset_code')
    .range(filters.from, filters.to)

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.productId) {
    query = query.eq('product_id', filters.productId)
  }

  if (filters.search) {
    query = query.or(`asset_code.ilike.%${filters.search}%,serial_number.ilike.%${filters.search}%`)
  }

  const { data, error, count } = await query

  if (error) {
    throw new AppError('We could not load inventory.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return { rows: data ?? [], total: count ?? 0 }
}

export async function insertAsset(client: Client, values: Database['public']['Tables']['equipment_assets']['Insert']) {
  const { data, error } = await client
    .from('equipment_assets')
    .insert(values)
    .select(ASSET_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not save that asset.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function updateAssetByUuid(
  client: Client,
  uuid: string,
  values: Database['public']['Tables']['equipment_assets']['Update'],
) {
  const { data, error } = await client
    .from('equipment_assets')
    .update(values)
    .eq('uuid', uuid)
    .select(ASSET_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not update that asset.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}
