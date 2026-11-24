import type { PublicSocialAd, PublicSocialAdVoucher, PublicSocialLink } from '~/types/social-link'
import { APP_NAME, FACEBOOK_URL, INSTAGRAM_URL } from './constants'
import { STORAGE_BUCKETS, publicStorageUrl } from './storage'

export interface SocialLinkRow {
  uuid: string
  label: string
  url: string
  sort_order: number
  is_active: boolean
  button_color?: string | null
  icon?: string | null
  updated_at: string | null
}

/** Curated Lucide keys for Social Media buttons (stored without `i-lucide-`). */
export const SOCIAL_BUTTON_ICONS = [
  { key: 'facebook', label: 'Facebook', lucide: 'i-lucide-facebook' },
  { key: 'instagram', label: 'Instagram', lucide: 'i-lucide-instagram' },
  { key: 'youtube', label: 'YouTube', lucide: 'i-lucide-youtube' },
  { key: 'twitter', label: 'X / Twitter', lucide: 'i-lucide-twitter' },
  { key: 'linkedin', label: 'LinkedIn', lucide: 'i-lucide-linkedin' },
  { key: 'tiktok', label: 'TikTok', lucide: 'i-lucide-music-2' },
  { key: 'message-circle', label: 'Messenger / Chat', lucide: 'i-lucide-message-circle' },
  { key: 'phone', label: 'Phone', lucide: 'i-lucide-phone' },
  { key: 'mail', label: 'Email', lucide: 'i-lucide-mail' },
  { key: 'globe', label: 'Website', lucide: 'i-lucide-globe' },
  { key: 'map-pin', label: 'Location', lucide: 'i-lucide-map-pin' },
  { key: 'calendar', label: 'Book / Calendar', lucide: 'i-lucide-calendar' },
  { key: 'shopping-bag', label: 'Shop', lucide: 'i-lucide-shopping-bag' },
  { key: 'camera', label: 'Camera', lucide: 'i-lucide-camera' },
  { key: 'video', label: 'Video', lucide: 'i-lucide-video' },
  { key: 'star', label: 'Reviews', lucide: 'i-lucide-star' },
  { key: 'heart', label: 'Favorites', lucide: 'i-lucide-heart' },
  { key: 'link', label: 'Link', lucide: 'i-lucide-link' },
] as const

export type SocialButtonIconKey = typeof SOCIAL_BUTTON_ICONS[number]['key']

const SOCIAL_BUTTON_ICON_KEYS = new Set<string>(SOCIAL_BUTTON_ICONS.map(item => item.key))

export function isSocialButtonIcon(value: unknown): value is SocialButtonIconKey {
  return typeof value === 'string' && SOCIAL_BUTTON_ICON_KEYS.has(value)
}

export function normalizeSocialButtonIcon(value: unknown): SocialButtonIconKey | null {
  return isSocialButtonIcon(value) ? value : null
}

export function socialButtonIconName(icon: string | null | undefined) {
  const key = normalizeSocialButtonIcon(icon)
  if (!key) {
    return null
  }
  return SOCIAL_BUTTON_ICONS.find(item => item.key === key)?.lucide || null
}

export interface SocialAdRow {
  uuid: string
  title: string
  subtitle: string | null
  image_storage_path: string | null
  link_url: string | null
  sort_order: number
  is_active: boolean
  updated_at: string | null
  voucher_id?: number | null
  voucher?: {
    uuid: string
    code: string
    name: string
    discount_type: 'percent' | 'fixed'
    discount_value: number
  } | Array<{
    uuid: string
    code: string
    name: string
    discount_type: 'percent' | 'fixed'
    discount_value: number
  }> | null
}

export function toPublicSocialLink(row: SocialLinkRow): PublicSocialLink {
  return {
    uuid: row.uuid,
    label: row.label,
    url: row.url,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    buttonColor: row.button_color && HEX_COLOR_RE.test(row.button_color.trim())
      ? row.button_color.trim().toLowerCase()
      : null,
    icon: normalizeSocialButtonIcon(row.icon),
    updatedAt: row.updated_at,
  }
}

export function socialAdVoucherLabel(voucher: {
  discount_type: 'percent' | 'fixed'
  discount_value: number
  name: string
}) {
  if (voucher.discount_type === 'percent') {
    return `${voucher.discount_value}% off · ${voucher.name}`
  }
  return `₱${Number(voucher.discount_value).toLocaleString('en-PH')} off · ${voucher.name}`
}

export function toPublicSocialAdVoucher(voucher: {
  uuid: string
  code: string
  name: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
}): PublicSocialAdVoucher {
  return {
    uuid: voucher.uuid,
    code: voucher.code,
    name: voucher.name,
    discountType: voucher.discount_type,
    discountValue: Number(voucher.discount_value),
    label: socialAdVoucherLabel(voucher),
  }
}

export function publicSocialAdImageUrl(supabaseUrl: string, storagePath: string | null | undefined) {
  if (!storagePath) {
    return null
  }
  return publicStorageUrl(supabaseUrl, STORAGE_BUCKETS.socialAdImages, storagePath)
}

export function toPublicSocialAd(row: SocialAdRow, supabaseUrl = ''): PublicSocialAd {
  const voucherRaw = Array.isArray(row.voucher) ? row.voucher[0] : row.voucher
  return {
    uuid: row.uuid,
    title: row.title || '',
    subtitle: row.subtitle,
    imageUrl: publicSocialAdImageUrl(supabaseUrl, row.image_storage_path),
    linkUrl: row.link_url,
    voucher: voucherRaw ? toPublicSocialAdVoucher(voucherRaw) : null,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  }
}

export const STARTER_SOCIAL_LINKS: PublicSocialLink[] = [
  { uuid: 'starter-facebook', label: 'Facebook', url: FACEBOOK_URL, sortOrder: 10, isActive: true, buttonColor: null, icon: 'facebook', updatedAt: null },
  { uuid: 'starter-instagram', label: 'Instagram', url: INSTAGRAM_URL, sortOrder: 20, isActive: true, buttonColor: null, icon: 'instagram', updatedAt: null },
]

export function sortSocialLinks(links: PublicSocialLink[]) {
  return [...links].sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label))
}

export function sortSocialAds(ads: PublicSocialAd[]) {
  return [...ads].sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title))
}

export const SOCIAL_PAGE_SETTING_KEY = 'social_page'
export const DEFAULT_SOCIAL_BUTTON_COLOR = '#1c1917'

const SOCIAL_PAGE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

export const SOCIAL_PAGE_TAGLINE = 'Rent. Create. Explore.'

export function socialPageMeta() {
  return {
    title: APP_NAME,
    subtitle: SOCIAL_PAGE_TAGLINE,
  }
}

export function normalizeSocialButtonColor(value: unknown, fallback = DEFAULT_SOCIAL_BUTTON_COLOR) {
  if (typeof value !== 'string') {
    return fallback
  }
  const color = value.trim()
  return HEX_COLOR_RE.test(color) ? color.toLowerCase() : fallback
}

/** White label on dark buttons, dark label on light buttons. */
export function socialButtonTextColor(background: string) {
  const hex = normalizeSocialButtonColor(background).slice(1)
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#1c1917' : '#ffffff'
}

export function resolveSocialButtonColor(linkColor: string | null | undefined, pageColor: string) {
  return linkColor ? normalizeSocialButtonColor(linkColor) : normalizeSocialButtonColor(pageColor)
}

export interface SocialPageSettings {
  code: string | null
  buttonColor: string
}

export function isSocialPageCode(value: string) {
  return /^jry-[a-z0-9]{8,16}$/i.test(value.trim())
}

export function normalizeSocialPageCode(value: string) {
  return value.trim().toLowerCase()
}

export function readSocialPageSettings(value: unknown): SocialPageSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { code: null, buttonColor: DEFAULT_SOCIAL_BUTTON_COLOR }
  }
  const record = value as { code?: unknown, buttonColor?: unknown }
  const code = typeof record.code === 'string' && isSocialPageCode(record.code)
    ? normalizeSocialPageCode(record.code)
    : null
  return {
    code,
    buttonColor: normalizeSocialButtonColor(record.buttonColor),
  }
}

/** Unique public path segment for the QR / share link, e.g. jry-k7m2p9xq4n */
export function createSocialPageCode() {
  let body = ''
  for (let index = 0; index < 10; index += 1) {
    body += SOCIAL_PAGE_ALPHABET[Math.floor(Math.random() * SOCIAL_PAGE_ALPHABET.length)]
  }
  return `jry-${body}`
}

export function socialPagePath(code: string) {
  return `/links/${normalizeSocialPageCode(code)}`
}

export function readSocialPageCode(value: unknown): string | null {
  return readSocialPageSettings(value).code
}
