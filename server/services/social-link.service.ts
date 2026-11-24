import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../types/database.types'
import type { AdminSocialLinkListResponse, PublicSocialAd, PublicSocialPage } from '../../types/social-link'
import type { SocialAdInput, SocialLinkInput, SocialPageAppearanceInput } from '../../utils/social-link-validation'
import {
  DEFAULT_SOCIAL_BUTTON_COLOR,
  SOCIAL_PAGE_SETTING_KEY,
  STARTER_SOCIAL_LINKS,
  createSocialPageCode,
  normalizeSocialPageCode,
  readSocialPageSettings,
  socialPageMeta,
  socialPagePath,
  sortSocialAds,
  sortSocialLinks,
  toPublicSocialAd,
  toPublicSocialLink,
} from '../../utils/social-link'
import { STORAGE_BUCKETS } from '../../utils/storage'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { compressImageForStorage, type UploadPart } from '../utils/image-compress'
import { getSupabaseAdminClient } from '../utils/supabase'
import { findSettingByKey, upsertSetting } from '../repositories/setting.repository'
import {
  createSocialAd,
  deleteSocialAd,
  findSocialAdByUuid,
  listSocialAds,
  updateSocialAd,
  updateSocialAdImagePath,
} from '../repositories/social-ad.repository'
import {
  createSocialLink,
  deleteSocialLink,
  findSocialLinkByUuid,
  listSocialLinks,
  updateSocialLink,
} from '../repositories/social-link.repository'

type Client = SupabaseClient<Database>

const SOCIAL_AD_BUCKET = STORAGE_BUCKETS.socialAdImages

function siteOrigin() {
  const config = useRuntimeConfig()
  return String(config.public.siteUrl || process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function supabasePublicUrl() {
  const config = useRuntimeConfig()
  return String(config.public.supabaseUrl || process.env.NUXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
}

function pageUrlFor(code: string) {
  return `${siteOrigin()}${socialPagePath(code)}`
}

function mapAds(rows: Awaited<ReturnType<typeof listSocialAds>>) {
  if (!rows) {
    return []
  }
  return sortSocialAds(rows.map(row => toPublicSocialAd(row, supabasePublicUrl())))
}

async function resolveVoucherId(client: Client, voucherUuid: string | null) {
  if (!voucherUuid) {
    return null
  }
  const { data, error } = await (client as unknown as SupabaseClient)
    .from('vouchers')
    .select('id, uuid, status')
    .eq('uuid', voucherUuid)
    .maybeSingle()
  if (error || !data) {
    throw new AppError('Choose an existing voucher.', 422, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
  return Number((data as { id: number }).id)
}

async function loadSocialPageSettings(client: Client) {
  try {
    const setting = await findSettingByKey(client, SOCIAL_PAGE_SETTING_KEY)
    return readSocialPageSettings(setting?.value)
  }
  catch {
    return { code: null as string | null, buttonColor: DEFAULT_SOCIAL_BUTTON_COLOR }
  }
}

async function saveSocialPageSettings(
  client: Client,
  next: { code: string, buttonColor: string },
) {
  await upsertSetting(client, SOCIAL_PAGE_SETTING_KEY, next)
  return next
}

/** Creates a unique page code the first time an admin opens Social Media. */
export async function ensureSocialPageSettings(client: Client) {
  const existing = await loadSocialPageSettings(client)
  if (existing.code) {
    return { code: existing.code, buttonColor: existing.buttonColor }
  }

  const code = createSocialPageCode()
  return saveSocialPageSettings(client, {
    code,
    buttonColor: existing.buttonColor || DEFAULT_SOCIAL_BUTTON_COLOR,
  })
}

export async function rotateSocialPageCode(event: H3Event, client: Client) {
  const previous = await loadSocialPageSettings(client)
  const code = createSocialPageCode()
  const next = await saveSocialPageSettings(client, {
    code,
    buttonColor: previous.buttonColor || DEFAULT_SOCIAL_BUTTON_COLOR,
  })
  await recordAudit(event, client, {
    action: 'social_page.rotate',
    entity: 'settings',
    entityId: SOCIAL_PAGE_SETTING_KEY,
    previous: previous.code ? { code: previous.code, buttonColor: previous.buttonColor } : undefined,
    next,
  })
  return { code: next.code, pageUrl: pageUrlFor(next.code), buttonColor: next.buttonColor }
}

export async function updateSocialPageAppearance(
  event: H3Event,
  client: Client,
  input: SocialPageAppearanceInput,
) {
  const current = await ensureSocialPageSettings(client)
  const next = await saveSocialPageSettings(client, {
    code: current.code,
    buttonColor: input.buttonColor.toLowerCase(),
  })
  await recordAudit(event, client, {
    action: 'social_page.appearance',
    entity: 'settings',
    entityId: SOCIAL_PAGE_SETTING_KEY,
    previous: current,
    next,
  })
  return { code: next.code, pageUrl: pageUrlFor(next.code), buttonColor: next.buttonColor }
}

export async function getPublicSocialPage(code: string): Promise<PublicSocialPage> {
  const admin = getSupabaseAdminClient()
  const page = await loadSocialPageSettings(admin)
  if (!page.code || page.code !== normalizeSocialPageCode(code)) {
    throw new AppError('Links page not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const [rows, ads] = await Promise.all([
    listSocialLinks(admin, true),
    listSocialAds(admin, true),
  ])
  const meta = socialPageMeta()
  return {
    title: meta.title,
    subtitle: meta.subtitle,
    pageUrl: pageUrlFor(page.code),
    buttonColor: page.buttonColor,
    links: rows === null
      ? STARTER_SOCIAL_LINKS
      : sortSocialLinks(rows.map(toPublicSocialLink)),
    ads: mapAds(ads),
  }
}

export async function getAdminSocialLinks(client: Client): Promise<AdminSocialLinkListResponse> {
  const [rows, ads] = await Promise.all([
    listSocialLinks(client),
    listSocialAds(client),
  ])
  const page = rows === null
    ? { code: createSocialPageCode(), buttonColor: DEFAULT_SOCIAL_BUTTON_COLOR }
    : await ensureSocialPageSettings(client)
  return {
    pageUrl: pageUrlFor(page.code),
    code: page.code,
    buttonColor: page.buttonColor,
    ready: rows !== null,
    adsReady: ads !== null,
    items: rows === null
      ? STARTER_SOCIAL_LINKS
      : sortSocialLinks(rows.map(toPublicSocialLink)),
    ads: mapAds(ads),
  }
}

function duplicateUrlMessage(error: unknown) {
  const cause = typeof error === 'object' && error && 'cause' in error
    ? (error as { cause?: { code?: string, message?: string } }).cause
    : null
  const message = `${cause?.message || ''} ${(error as { message?: string })?.message || ''}`.toLowerCase()
  return cause?.code === '23505' || message.includes('social_links_url_unique') || message.includes('duplicate')
}

export async function saveSocialLink(event: H3Event, client: Client, input: SocialLinkInput, uuid?: string) {
  const previous = uuid ? await findSocialLinkByUuid(client, uuid) : null
  if (uuid && !previous) {
    throw new AppError('Social link not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const payload = {
    label: input.label,
    url: input.url,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    buttonColor: input.buttonColor ?? null,
    icon: input.icon ?? null,
  }

  let row
  try {
    row = uuid ? await updateSocialLink(client, uuid, payload) : await createSocialLink(client, payload)
  }
  catch (error) {
    if (duplicateUrlMessage(error)) {
      throw new AppError('That link is already used on another button. Each link must be unique.', 409, ERROR_CODES.CONFLICT, { cause: error })
    }
    throw error
  }
  const next = toPublicSocialLink(row)

  await recordAudit(event, client, {
    action: uuid ? 'social_link.update' : 'social_link.create',
    entity: 'social_links',
    entityId: next.uuid,
    previous: previous ? toPublicSocialLink(previous) as unknown as Json : undefined,
    next: next as unknown as Json,
  })

  return next
}

export async function removeSocialLink(event: H3Event, client: Client, uuid: string) {
  const previous = await findSocialLinkByUuid(client, uuid)
  if (!previous) {
    throw new AppError('Social link not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  await deleteSocialLink(client, uuid)
  await recordAudit(event, client, {
    action: 'social_link.delete',
    entity: 'social_links',
    entityId: uuid,
    previous: toPublicSocialLink(previous) as unknown as Json,
  })

  return { uuid }
}

export async function saveSocialAd(event: H3Event, client: Client, input: SocialAdInput, uuid?: string) {
  const previous = uuid ? await findSocialAdByUuid(client, uuid) : null
  if (uuid && !previous) {
    throw new AppError('Social ad not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const voucherId = await resolveVoucherId(client, input.voucherUuid ?? null)
  const hasContent = Boolean(previous?.image_storage_path) || Boolean(voucherId)

  if (input.isActive && !hasContent) {
    throw new AppError('Upload a promo image or choose a voucher before showing this ad.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  const payload = {
    title: input.title || '',
    subtitle: input.subtitle || null,
    linkUrl: input.linkUrl || null,
    voucherId,
    sortOrder: input.sortOrder,
    isActive: input.isActive && hasContent,
  }

  const row = uuid
    ? await updateSocialAd(client, uuid, payload)
    : await createSocialAd(client, payload)

  const next = toPublicSocialAd(row, supabasePublicUrl())
  await recordAudit(event, client, {
    action: uuid ? 'social_ad.update' : 'social_ad.create',
    entity: 'social_ads',
    entityId: next.uuid,
    previous: previous ? toPublicSocialAd(previous, supabasePublicUrl()) as unknown as Json : undefined,
    next: next as unknown as Json,
  })
  return next
}

export async function uploadSocialAdImage(
  event: H3Event,
  client: Client,
  uuid: string,
  file: UploadPart,
) {
  const current = await findSocialAdByUuid(client, uuid)
  if (!current) {
    throw new AppError('Social ad not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const image = await compressImageForStorage(file, {
    label: 'promo image',
    maxEdge: 1600,
  })
  const storagePath = `${uuid}/${crypto.randomUUID()}.${image.extension}`
  const { error } = await client.storage.from(SOCIAL_AD_BUCKET).upload(storagePath, image.data, {
    contentType: image.type,
    upsert: false,
  })
  if (error) {
    throw new AppError('We could not upload that promo image.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  let row
  try {
    row = await updateSocialAdImagePath(client, uuid, storagePath)
  }
  catch (caught) {
    await client.storage.from(SOCIAL_AD_BUCKET).remove([storagePath])
    throw caught
  }

  const previousPath = current.image_storage_path || null
  if (previousPath) {
    await client.storage.from(SOCIAL_AD_BUCKET).remove([previousPath])
  }

  await recordAudit(event, client, {
    action: 'social_ad.image.upload',
    entity: 'social_ads',
    entityId: uuid,
    previous: { storagePath: previousPath },
    next: { storagePath },
  })

  return toPublicSocialAd(row, supabasePublicUrl())
}

export async function removeSocialAdImage(event: H3Event, client: Client, uuid: string) {
  const current = await findSocialAdByUuid(client, uuid)
  if (!current) {
    throw new AppError('Social ad not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  if (!current.image_storage_path) {
    throw new AppError('This ad has no promo image.', 422, ERROR_CODES.VALIDATION_ERROR)
  }
  if (!current.voucher_id && current.is_active) {
    throw new AppError('Hide the ad or add a voucher before removing the only promo image.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  const previousPath = current.image_storage_path || null
  const row = await updateSocialAdImagePath(client, uuid, null)
  if (previousPath) {
    await client.storage.from(SOCIAL_AD_BUCKET).remove([previousPath])
  }

  await recordAudit(event, client, {
    action: 'social_ad.image.delete',
    entity: 'social_ads',
    entityId: uuid,
    previous: { storagePath: previousPath },
  })

  return toPublicSocialAd(row, supabasePublicUrl())
}

export async function removeSocialAd(event: H3Event, client: Client, uuid: string) {
  const previous = await findSocialAdByUuid(client, uuid)
  if (!previous) {
    throw new AppError('Social ad not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  await deleteSocialAd(client, uuid)
  if (previous.image_storage_path) {
    await client.storage.from(SOCIAL_AD_BUCKET).remove([previous.image_storage_path]).catch(() => null)
  }

  await recordAudit(event, client, {
    action: 'social_ad.delete',
    entity: 'social_ads',
    entityId: uuid,
    previous: toPublicSocialAd(previous, supabasePublicUrl()) as unknown as Json,
  })

  return { uuid }
}

export type { PublicSocialAd }
