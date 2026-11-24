import { describe, expect, it } from 'vitest'
import { socialAdInputSchema, socialLinkInputSchema } from '../../utils/social-link-validation'
import {
  createSocialPageCode,
  isSocialPageCode,
  normalizeSocialButtonColor,
  socialButtonTextColor,
  socialPagePath,
  sortSocialLinks,
  STARTER_SOCIAL_LINKS,
  toPublicSocialLink,
} from '../../utils/social-link'
import { qrSvg } from '../../utils/qr'
import { socialPageAppearanceSchema } from '../../utils/social-link-validation'

describe('social links', () => {
  it('accepts https button links', () => {
    expect(socialLinkInputSchema.parse({
      label: 'Facebook',
      url: 'https://www.facebook.com/jryrentals/',
      sortOrder: 10,
      isActive: true,
    }).label).toBe('Facebook')
  })

  it('rejects non-http links', () => {
    expect(socialLinkInputSchema.safeParse({
      label: 'Bad',
      url: 'javascript:alert(1)',
      sortOrder: 0,
      isActive: true,
    }).success).toBe(false)
  })

  it('maps rows and sorts by order', () => {
    expect(toPublicSocialLink({
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      label: 'Instagram',
      url: 'https://www.instagram.com/jryrentals',
      sort_order: 20,
      is_active: true,
      button_color: '#12201a',
      icon: 'instagram',
      updated_at: null,
    })).toEqual({
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      label: 'Instagram',
      url: 'https://www.instagram.com/jryrentals',
      sortOrder: 20,
      isActive: true,
      buttonColor: '#12201a',
      icon: 'instagram',
      updatedAt: null,
    })
    expect(sortSocialLinks([
      { ...STARTER_SOCIAL_LINKS[1]!, sortOrder: 30 },
      { ...STARTER_SOCIAL_LINKS[0]!, sortOrder: 10 },
    ]).map(link => link.label)).toEqual(['Facebook', 'Instagram'])
  })

  it('builds a unique page path for the QR', () => {
    const code = createSocialPageCode()
    expect(isSocialPageCode(code)).toBe(true)
    expect(socialPagePath(code)).toMatch(/^\/links\/jry-[a-z0-9]+$/)
    expect(qrSvg(`https://jryrentals.com${socialPagePath(code)}`)).toContain('<svg')
  })

  it('normalizes button colors and picks readable text', () => {
    expect(normalizeSocialButtonColor('#0F1C17')).toBe('#0f1c17')
    expect(socialPageAppearanceSchema.parse({ buttonColor: '#12201a' }).buttonColor).toBe('#12201a')
    expect(socialButtonTextColor('#1c1917')).toBe('#ffffff')
    expect(socialButtonTextColor('#f5f5f4')).toBe('#1c1917')
  })

  it('accepts optional per-button color, icon, and social ad payloads', () => {
    expect(socialLinkInputSchema.parse({
      label: 'TikTok',
      url: 'https://www.tiktok.com/@jryrentals',
      sortOrder: 30,
      isActive: true,
      buttonColor: '#0f172a',
      icon: 'tiktok',
    })).toMatchObject({ buttonColor: '#0f172a', icon: 'tiktok' })
    expect(socialLinkInputSchema.safeParse({
      label: 'Bad icon',
      url: 'https://example.com',
      sortOrder: 0,
      isActive: true,
      icon: 'not-a-real-icon',
    }).success).toBe(false)
    expect(socialAdInputSchema.parse({
      title: 'Weekend deal',
      subtitle: null,
      linkUrl: '',
      voucherUuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      sortOrder: 10,
      isActive: true,
    }).voucherUuid).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  })
})
