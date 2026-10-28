import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FEEDBACK_REWARD,
  FEEDBACK_REWARD_MIN_COMMENT,
  earnsFeedbackReward,
  feedbackRewardLabel,
  feedbackRewardSettingsSchema,
  feedbackRewardStock,
  feedbackRewardUnavailableReason,
  readFeedbackRewardSettings,
} from '../../utils/feedback-reward'

const voucherUuid = '11111111-1111-4111-8111-111111111111'
const on = { enabled: true, voucherUuid }
const voucher = {
  status: 'active' as const,
  discount_type: 'fixed' as const,
  discount_value: 100,
  max_redemptions: 10,
  redeemed_count: 0,
  starts_on: null,
  ends_on: '2026-12-31',
}
const today = '2026-10-28'

describe('feedback thank-you voucher', () => {
  it('is only earned when a voucher is chosen and the comment is written', () => {
    expect(earnsFeedbackReward(on, 'Great Starlink, fast and easy to set up.')).toBe(true)
    expect(earnsFeedbackReward(on, 'ok')).toBe(false)
    expect(earnsFeedbackReward(on, '          ')).toBe(false)
    expect(earnsFeedbackReward(on, null)).toBe(false)
    expect(earnsFeedbackReward({ enabled: false, voucherUuid }, 'Great Starlink, fast and easy to set up.')).toBe(false)
    expect(earnsFeedbackReward({ enabled: true, voucherUuid: null }, 'Great Starlink, fast and easy to set up.')).toBe(false)
    expect(FEEDBACK_REWARD_MIN_COMMENT).toBe(10)
  })

  it('counts the template voucher Max uses as how many unique codes can be given', () => {
    expect(feedbackRewardStock(voucher, 3)).toEqual({ limit: 10, given: 3, left: 7 })
    expect(feedbackRewardStock(voucher, 12).left).toBe(0)
    expect(feedbackRewardStock({ ...voucher, max_redemptions: null }, 25).left).toBeNull()
  })

  it('stops giving codes when they run out, the voucher ends, or it is turned off', () => {
    expect(feedbackRewardUnavailableReason(voucher, 3, today)).toBeNull()
    expect(feedbackRewardUnavailableReason(voucher, 10, today)).toBe('All codes have been given out.')
    expect(feedbackRewardUnavailableReason({ ...voucher, ends_on: '2026-10-27' }, 0, today)).toBe('This voucher has expired.')
    expect(feedbackRewardUnavailableReason({ ...voucher, starts_on: '2026-11-01' }, 0, today)).toBe('This voucher has not started yet.')
    expect(feedbackRewardUnavailableReason({ ...voucher, status: 'disabled' }, 0, today)).toBe('This voucher is disabled.')
    expect(feedbackRewardUnavailableReason({ ...voucher, status: 'draft' }, 0, today)).toBeNull()
    expect(feedbackRewardUnavailableReason(null, 0, today)).toBe('Choose a voucher.')
    expect(feedbackRewardUnavailableReason({ ...voucher, max_redemptions: null }, 500, today)).toBeNull()
  })

  it('describes the voucher for customers in PHP or percent', () => {
    expect(feedbackRewardLabel({ discountType: 'fixed', discountValue: 100 })).toBe('₱100.00 off your next rental')
    expect(feedbackRewardLabel({ discountType: 'percent', discountValue: 10 })).toBe('10% off your next rental')
  })

  it('needs a voucher to turn on and falls back to off when nothing is saved', () => {
    expect(feedbackRewardSettingsSchema.safeParse({ enabled: true, voucherUuid: null }).success).toBe(false)
    expect(feedbackRewardSettingsSchema.safeParse({ enabled: false, voucherUuid: null }).success).toBe(true)
    expect(feedbackRewardSettingsSchema.safeParse(on).success).toBe(true)
    expect(readFeedbackRewardSettings(null)).toEqual(DEFAULT_FEEDBACK_REWARD)
    expect(readFeedbackRewardSettings({ enabled: 'yes' }).enabled).toBe(false)
  })
})
