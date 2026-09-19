import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { ProductStatus } from '../../utils/constants'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const PRODUCT_SELECT = `
  id,
  uuid,
  slug,
  sku,
  name,
  description,
  short_description,
  daily_price,
  weekly_price,
  monthly_price,
  deposit_amount,
  late_fee,
  replacement_value,
  hidden_price_fields,
  quantity,
  reserved_quantity,
  rented_quantity,
  damaged_quantity,
  maintenance_quantity,
  lost_quantity,
  available_quantity,
  status,
  condition,
  specifications,
  included_accessories,
  rental_rules,
  model_path,
  is_featured,
  product_categories (
    uuid,
    slug,
    name,
    description,
    sort_order,
    is_active
  )
`

export async function listProducts(client: Client, filters: {
  search?: string
  status?: ProductStatus
  statuses?: ProductStatus[]
  categoryId?: number
  featured?: boolean
  from: number
  to: number
}) {
  let query = client
    .from('products')
    .select(PRODUCT_SELECT, { count: 'exact' })
    .order('is_featured', { ascending: false })
    .order('name')
    .range(filters.from, filters.to)

  if (filters.statuses?.length) {
    query = query.in('status', filters.statuses)
  }
  else if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.featured) {
    query = query.eq('is_featured', true)
  }

  if (filters.categoryId) {
    query = query.eq('category_id', filters.categoryId)
  }

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,slug.ilike.%${filters.search}%`)
  }

  const { data, error, count } = await query

  if (error) {
    throw new AppError('We could not load products.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return { rows: data ?? [], total: count ?? 0 }
}

export async function findProductByUuid(client: Client, uuid: string) {
  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that product.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function findProductBySlug(client: Client, slug: string) {
  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that product.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function findProductIdByUuid(client: Client, uuid: string) {
  const { data, error } = await client
    .from('products')
    .select('id, uuid')
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that product.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function findCategoryIdBySlug(client: Client, slug: string) {
  const { data, error } = await client
    .from('product_categories')
    .select('id, uuid, slug')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that category.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function findCategoryIdByUuid(client: Client, uuid: string) {
  const { data, error } = await client
    .from('product_categories')
    .select('id, uuid')
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that category.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function insertProduct(client: Client, values: Database['public']['Tables']['products']['Insert']) {
  const { data, error } = await client
    .from('products')
    .insert(values)
    .select(PRODUCT_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not save that product.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function updateProductByUuid(
  client: Client,
  uuid: string,
  values: Database['public']['Tables']['products']['Update'],
) {
  const { data, error } = await client
    .from('products')
    .update(values)
    .eq('uuid', uuid)
    .select(PRODUCT_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not update that product.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function listProductImages(client: Client, productId: number) {
  const { data, error } = await client
    .from('product_images')
    .select('uuid, storage_path, alt, sort_order, product_id')
    .eq('product_id', productId)
    .order('sort_order')

  if (error) {
    throw new AppError('We could not load product images.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function listImagesByProductIds(client: Client, productIds: number[]) {
  if (!productIds.length) {
    return []
  }

  const { data, error } = await client
    .from('product_images')
    .select('uuid, storage_path, alt, sort_order, product_id')
    .in('product_id', productIds)
    .order('sort_order')

  if (error) {
    throw new AppError('We could not load product images.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function insertProductImage(client: Client, values: {
  productId: number
  storagePath: string
  alt: string
  sortOrder: number
}) {
  const { data, error } = await client
    .from('product_images')
    .insert({
      product_id: values.productId,
      storage_path: values.storagePath,
      alt: values.alt,
      sort_order: values.sortOrder,
    })
    .select('uuid, storage_path, alt, sort_order')
    .single()

  if (error || !data) {
    throw new AppError('We could not save that image.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function findImageByUuid(client: Client, uuid: string) {
  const { data, error } = await client
    .from('product_images')
    .select('uuid, storage_path, product_id')
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that image.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function countRentalItemsForProduct(client: Client, productId: number) {
  const { count, error } = await client
    .from('rental_items')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)

  if (error) {
    throw new AppError('We could not check rental history.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return count ?? 0
}

export async function listAssetIdsForProduct(client: Client, productId: number) {
  const { data, error } = await client
    .from('equipment_assets')
    .select('id')
    .eq('product_id', productId)

  if (error) {
    throw new AppError('We could not load product assets.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return (data ?? []).map(row => row.id)
}

export async function countAssetAssignments(client: Client, assetIds: number[]) {
  if (!assetIds.length) {
    return 0
  }

  const { count, error } = await client
    .from('rental_asset_assignments')
    .select('id', { count: 'exact', head: true })
    .in('equipment_asset_id', assetIds)

  if (error) {
    throw new AppError('We could not check asset history.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return count ?? 0
}

export async function deleteAssetsByProductId(client: Client, productId: number) {
  const { error } = await client
    .from('equipment_assets')
    .delete()
    .eq('product_id', productId)

  if (error) {
    throw new AppError('We could not remove product assets.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}

export async function deleteProductByUuid(client: Client, uuid: string) {
  const { error } = await client
    .from('products')
    .delete()
    .eq('uuid', uuid)

  if (error) {
    throw new AppError('We could not delete that product.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}

export async function deleteImageByUuid(client: Client, uuid: string) {
  const { error } = await client
    .from('product_images')
    .delete()
    .eq('uuid', uuid)

  if (error) {
    throw new AppError('We could not remove that image.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}
