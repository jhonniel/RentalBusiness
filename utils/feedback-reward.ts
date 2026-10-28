import { z } from 'zod'
import type { VoucherDiscountType, VoucherStatus } from './constants'
import { formatMoney } from './currency'

export const FEEDBACK_REWARD_SETTING_KEY = 'feedback_reward'
export const FEEDBACK_REWARD_MIN_COMMENT = 10

export interface FeedbackRewardSettings {
  enabled: boolean
  voucherUuid: string | null
}

export interface FeedbackRewardOffer {
  label: string
  minCommentLength: number
}

export interface FeedbackRewardVoucher {
  code: string
  label: string
  minSubtotal: number
  endsOn: string | null
}

export interface FeedbackRewardVoucherRow {
  status: VoucherStatus
  discount_type: VoucherDiscountType
  discount_value: number
  max_redemptions: number | null
  redeemed_count: number
  starts_on: string | null
  ends_on: string | null
}

export const DEFAULT_FEEDBACK_REWARD: FeedbackRewardSettings = {
  enabled: false,
  voucherUuid: null,
}

export const feedbackRewardSettingsSchema = z.object({
  enabled: z.boolean(),
  voucherUuid: z.string().uuid('Choose a voucher.').nullable(),
}).strict().refine(value => !value.enabled || Boolean(value.voucherUuid), {
  message: 'Choose a voucher to give.',
  path: ['voucherUuid'],
})

export type FeedbackRewardSettingsInput = z.infer<typeof feedbackRewardSettingsSchema>

export function readFeedbackRewardSettings(value: unknown): FeedbackRewardSettings {
  const parsed = feedbackRewardSettingsSchema.safeParse(value)
  return parsed.success ? parsed.data : DEFAULT_FEEDBACK_REWARD
}

export function feedbackRewardLabel(input: { discountType: VoucherDiscountType, discountValue: number }) {
  return input.discountType === 'percent'
    ? `${Number(input.discountValue)}% off your next rental`
    : `${formatMoney(Number(input.discountValue))} off your next rental`
}

export function feedbackRewardStock(voucher: Pick<FeedbackRewardVoucherRow, 'max_redemptions'>, given: number) {
  if (voucher.max_redemptions === null) {
    return { limit: null, given, left: null }
  }
  return { limit: voucher.max_redemptions, given, left: Math.max(0, voucher.max_redemptions - given) }
}

export function feedbackRewardUnavailableReason(voucher: FeedbackRewardVoucherRow | null, given: number, today: string) {
  if (!voucher) {
    return 'Choose a voucher.'
  }
  if (voucher.status === 'disabled') {
    return 'This voucher is disabled.'
  }
  if (voucher.starts_on && voucher.starts_on > today) {
    return 'This voucher has not started yet.'
  }
  if (voucher.ends_on && voucher.ends_on < today) {
    return 'This voucher has expired.'
  }
  if (feedbackRewardStock(voucher, given).left === 0) {
    return 'All codes have been given out.'
  }
  return null
}

export function earnsFeedbackReward(settings: FeedbackRewardSettings, comment: string | null | undefined) {
  return settings.enabled && Boolean(settings.voucherUuid) && (comment?.trim().length ?? 0) >= FEEDBACK_REWARD_MIN_COMMENT
}
