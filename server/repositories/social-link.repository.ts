import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { SocialLinkRow } from '../../utils/social-link'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const SOCIAL_LINK_SELECT = 'uuid, label, url, sort_order, is_active, button_color, icon, updated_at'
const SOCIAL_LINK_SELECT_COLOR = 'uuid, label, url, sort_order, is_active, button_color, updated_at'
const SOCIAL_LINK_SELECT_LEGACY = 'uuid, label, url, sort_order, is_active, updated_at'

export const SOCIAL_LINK_SETUP_MESSAGE = 'Paste the social links SQL in Supabase to turn on Social Media.'

function table(client: Client) {
  return (client as unknown as SupabaseClient).from('social_links')
}

export function isMissingSocialLinkTable(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

function isMissingColumn(error: { code?: string } | null) {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

function failure(message: string, error: { code?: string, message?: string } | null): never {
  if (isMissingSocialLinkTable(error)) {
    throw new AppError(SOCIAL_LINK_SETUP_MESSAGE, 409, ERROR_CODES.CONFLICT, { cause: error })
  }
  if (error?.code === '23505') {
    throw new AppError('That link is already used on another button. Each link must be unique.', 409, ERROR_CODES.CONFLICT, { cause: error })
  }
  throw new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
}

function normalizeRow(row: Record<string, unknown>): SocialLinkRow {
  return {
    uuid: String(row.uuid),
    label: String(row.label),
    url: String(row.url),
    sort_order: Number(row.sort_order),
    is_active: Boolean(row.is_active),
    button_color: (row.button_color as string | null | undefined) ?? null,
    icon: (row.icon as string | null | undefined) ?? null,
    updated_at: (row.updated_at as string | null | undefined) ?? null,
  }
}

async function selectWithFallback(
  run: (select: string) => Promise<{ data: unknown, error: { code?: string } | null }>,
) {
  let result = await run(SOCIAL_LINK_SELECT)
  if (isMissingColumn(result.error)) {
    result = await run(SOCIAL_LINK_SELECT_COLOR)
  }
  if (isMissingColumn(result.error)) {
    result = await run(SOCIAL_LINK_SELECT_LEGACY)
  }
  return result
}

export async function listSocialLinks(client: Client, activeOnly = false): Promise<SocialLinkRow[] | null> {
  const result = await selectWithFallback(async (select) => {
    let query = table(client)
      .select(select)
      .order('sort_order')
      .order('created_at')
      .limit(100)
    if (activeOnly) {
      query = query.eq('is_active', true)
    }
    return query
  })

  if (isMissingSocialLinkTable(result.error)) {
    return null
  }
  if (result.error) {
    throw new AppError('We could not load the social links.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: result.error })
  }
  return ((result.data as Record<string, unknown>[] | null) ?? []).map(normalizeRow)
}

export async function findSocialLinkByUuid(client: Client, uuid: string): Promise<SocialLinkRow | null> {
  const result = await selectWithFallback(async select =>
    table(client).select(select).eq('uuid', uuid).maybeSingle(),
  )
  if (result.error) {
    failure('We could not load that social link.', result.error)
  }
  if (!result.data) {
    return null
  }
  return normalizeRow(result.data as Record<string, unknown>)
}

export async function createSocialLink(client: Client, input: {
  label: string
  url: string
  sortOrder: number
  isActive: boolean
  buttonColor?: string | null
  icon?: string | null
}) {
  const payload: Record<string, unknown> = {
    label: input.label,
    url: input.url,
    sort_order: input.sortOrder,
    is_active: input.isActive,
    button_color: input.buttonColor ?? null,
    icon: input.icon ?? null,
  }

  let { data, error } = await table(client).insert(payload).select(SOCIAL_LINK_SELECT).single()
  if (isMissingColumn(error)) {
    delete payload.icon
    ;({ data, error } = await table(client).insert(payload).select(SOCIAL_LINK_SELECT_COLOR).single())
  }
  if (isMissingColumn(error)) {
    delete payload.button_color
    ;({ data, error } = await table(client).insert(payload).select(SOCIAL_LINK_SELECT_LEGACY).single())
  }
  if (error || !data) {
    failure('We could not add that social link.', error)
  }
  return normalizeRow(data as Record<string, unknown>)
}

export async function updateSocialLink(client: Client, uuid: string, input: {
  label: string
  url: string
  sortOrder: number
  isActive: boolean
  buttonColor?: string | null
  icon?: string | null
}) {
  const payload: Record<string, unknown> = {
    label: input.label,
    url: input.url,
    sort_order: input.sortOrder,
    is_active: input.isActive,
    button_color: input.buttonColor ?? null,
    icon: input.icon ?? null,
  }

  let { data, error } = await table(client)
    .update(payload)
    .eq('uuid', uuid)
    .select(SOCIAL_LINK_SELECT)
    .maybeSingle()
  if (isMissingColumn(error)) {
    delete payload.icon
    ;({ data, error } = await table(client)
      .update(payload)
      .eq('uuid', uuid)
      .select(SOCIAL_LINK_SELECT_COLOR)
      .maybeSingle())
  }
  if (isMissingColumn(error)) {
    delete payload.button_color
    ;({ data, error } = await table(client)
      .update(payload)
      .eq('uuid', uuid)
      .select(SOCIAL_LINK_SELECT_LEGACY)
      .maybeSingle())
  }
  if (error) {
    failure('We could not update that social link.', error)
  }
  if (!data) {
    throw new AppError('Social link not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  return normalizeRow(data as Record<string, unknown>)
}

export async function deleteSocialLink(client: Client, uuid: string) {
  const { error } = await table(client).delete().eq('uuid', uuid)
  if (error) {
    failure('We could not delete that social link.', error)
  }
}
