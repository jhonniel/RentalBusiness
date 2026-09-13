import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const CATEGORY_SELECT = 'uuid, slug, name, description, sort_order, is_active'

export async function listCategories(client: Client) {
  const { data, error } = await client
    .from('product_categories')
    .select(CATEGORY_SELECT)
    .order('sort_order')
    .order('name')

  if (error) {
    throw new AppError('We could not load categories.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function findCategoryBySlug(client: Client, slug: string) {
  const { data, error } = await client
    .from('product_categories')
    .select(CATEGORY_SELECT)
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that category.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function findCategoryByUuid(client: Client, uuid: string) {
  const { data, error } = await client
    .from('product_categories')
    .select(CATEGORY_SELECT)
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that category.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function createCategory(client: Client, input: {
  name: string
  slug: string
  description: string | null
  sortOrder: number
  isActive: boolean
}) {
  const { data, error } = await client
    .from('product_categories')
    .insert({
      name: input.name,
      slug: input.slug,
      description: input.description,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    })
    .select(CATEGORY_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not create that category.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function updateCategory(client: Client, uuid: string, input: {
  name: string
  slug: string
  description: string | null
  sortOrder: number
  isActive: boolean
}) {
  const { data, error } = await client
    .from('product_categories')
    .update({
      name: input.name,
      slug: input.slug,
      description: input.description,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    })
    .eq('uuid', uuid)
    .select(CATEGORY_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not update that category.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}
