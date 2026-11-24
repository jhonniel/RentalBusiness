import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { SocialAdRow } from '../../utils/social-link'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const AD_SELECT = `
  uuid,
  title,
  subtitle,
  image_storage_path,
  link_url,
  sort_order,
  is_active,
  updated_at,
  voucher_id,
  voucher:vouchers!social_ads_voucher_id_fkey ( uuid, code, name, discount_type, discount_value )
`

export const SOCIAL_AD_SETUP_MESSAGE = 'Paste the social ads SQL in Supabase to turn on promos.'

function table(client: Client) {
  return (client as unknown as SupabaseClient).from('social_ads')
}

export function isMissingSocialAdTable(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

function failure(message: string, error: { code?: string } | null): never {
  if (isMissingSocialAdTable(error)) {
    throw new AppError(SOCIAL_AD_SETUP_MESSAGE, 409, ERROR_CODES.CONFLICT, { cause: error })
  }
  throw new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
}

export async function listSocialAds(client: Client, activeOnly = false): Promise<SocialAdRow[] | null> {
  let query = table(client)
    .select(AD_SELECT)
    .order('sort_order')
    .order('created_at')
    .limit(40)
  if (activeOnly) {
    query = query.eq('is_active', true)
  }
  const { data, error } = await query
  if (isMissingSocialAdTable(error)) {
    return null
  }
  if (error) {
    throw new AppError('We could not load the social ads.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }
  return (data ?? []) as unknown as SocialAdRow[]
}

export async function findSocialAdByUuid(client: Client, uuid: string): Promise<SocialAdRow | null> {
  const { data, error } = await table(client).select(AD_SELECT).eq('uuid', uuid).maybeSingle()
  if (error) {
    failure('We could not load that social ad.', error)
  }
  return (data as unknown as SocialAdRow | null) ?? null
}

export async function createSocialAd(client: Client, input: {
  title: string
  subtitle: string | null
  linkUrl: string | null
  voucherId: number | null
  sortOrder: number
  isActive: boolean
  imageStoragePath?: string | null
}) {
  const { data, error } = await table(client)
    .insert({
      title: input.title,
      subtitle: input.subtitle,
      link_url: input.linkUrl,
      voucher_id: input.voucherId,
      sort_order: input.sortOrder,
      is_active: input.isActive,
      image_storage_path: input.imageStoragePath ?? null,
    })
    .select(AD_SELECT)
    .single()
  if (error || !data) {
    failure('We could not add that social ad.', error)
  }
  return data as unknown as SocialAdRow
}

export async function updateSocialAd(client: Client, uuid: string, input: {
  title: string
  subtitle: string | null
  linkUrl: string | null
  voucherId: number | null
  sortOrder: number
  isActive: boolean
}) {
  const { data, error } = await table(client)
    .update({
      title: input.title,
      subtitle: input.subtitle,
      link_url: input.linkUrl,
      voucher_id: input.voucherId,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    })
    .eq('uuid', uuid)
    .select(AD_SELECT)
    .maybeSingle()
  if (error) {
    failure('We could not update that social ad.', error)
  }
  if (!data) {
    throw new AppError('Social ad not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  return data as unknown as SocialAdRow
}

export async function updateSocialAdImagePath(client: Client, uuid: string, storagePath: string | null) {
  const { data, error } = await table(client)
    .update({ image_storage_path: storagePath })
    .eq('uuid', uuid)
    .select(AD_SELECT)
    .maybeSingle()
  if (error) {
    failure('We could not update that social ad image.', error)
  }
  if (!data) {
    throw new AppError('Social ad not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  return data as unknown as SocialAdRow
}

export async function deleteSocialAd(client: Client, uuid: string) {
  const { error } = await table(client).delete().eq('uuid', uuid)
  if (error) {
    failure('We could not delete that social ad.', error)
  }
}
