import { z } from 'zod'
import { SOCIAL_BUTTON_ICONS } from './social-link'

const hexColor = z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, 'Choose a color like #1c1917.')
const socialIconKeys = SOCIAL_BUTTON_ICONS.map(item => item.key) as [string, ...string[]]

export const socialLinkInputSchema = z.object({
  label: z.string().trim().min(1, 'Add a button label.').max(80, 'Keep the label under 80 characters.'),
  url: z.string().trim().url('Enter a full link starting with https://').max(500, 'Keep the link under 500 characters.')
    .refine(value => /^https?:\/\//i.test(value), 'Links must start with http:// or https://.'),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
  buttonColor: hexColor.nullable().optional().default(null),
  icon: z.union([
    z.literal(''),
    z.enum(socialIconKeys, { errorMap: () => ({ message: 'Choose an icon from the list.' }) }),
  ]).nullable().optional().transform(value => (!value ? null : value)),
}).strict()

export type SocialLinkInput = z.infer<typeof socialLinkInputSchema>

export const socialPageAppearanceSchema = z.object({
  buttonColor: hexColor,
}).strict()

export type SocialPageAppearanceInput = z.infer<typeof socialPageAppearanceSchema>

export const socialAdInputSchema = z.object({
  title: z.string().trim().max(120, 'Keep the title under 120 characters.').default(''),
  subtitle: z.string().trim().max(240, 'Keep the subtitle under 240 characters.').nullable().optional().default(null),
  linkUrl: z.union([
    z.literal(''),
    z.string().trim().url('Enter a full link starting with https://').max(500)
      .refine(value => /^https?:\/\//i.test(value), 'Links must start with http:// or https://.'),
  ]).nullable().optional().transform(value => (!value ? null : value)),
  voucherUuid: z.union([
    z.literal(''),
    z.string().uuid('Choose a voucher.'),
  ]).nullable().optional().transform(value => (!value ? null : value)),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
}).strict()

export type SocialAdInput = z.infer<typeof socialAdInputSchema>
