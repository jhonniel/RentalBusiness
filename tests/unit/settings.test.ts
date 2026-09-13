import { describe, expect, it } from 'vitest'
import { businessSettingsInputSchema } from '../../utils/settings-validation'
import { toPublicBusinessSettings } from '../../utils/settings'

describe('business settings', () => {
  it('accepts contact details and rejects currency or timezone writes', () => {
    expect(businessSettingsInputSchema.parse({
      name: 'JRY Rentals',
      email: 'jryrentals@gmail.com',
      phone: '+63 2 8000 0000',
      address: 'Davao City, Philippines',
      lateFeePolicy: 'Late returns are charged per day.',
      depositRules: 'A refundable deposit is authorized at checkout.',
      cancellationRules: 'Cancellations more than 48 hours before pickup may be refunded.',
    })).toMatchObject({
      name: 'JRY Rentals',
      email: 'jryrentals@gmail.com',
    })

    expect(businessSettingsInputSchema.safeParse({
      name: 'JRY Rentals',
      currency: 'USD',
    }).success).toBe(false)

    expect(businessSettingsInputSchema.safeParse({
      name: 'JRY Rentals',
      timezone: 'UTC',
    }).success).toBe(false)
  })

  it('always publishes PHP and Asia/Manila on the public payload', () => {
    expect(toPublicBusinessSettings({
      uuid: '11111111-1111-1111-1111-111111111111',
      name: 'JRY Rentals',
      email: 'jryrentals@gmail.com',
      phone: null,
      address: 'Davao City',
      currency: 'USD',
      timezone: 'UTC',
      late_fee_policy: 'Per day',
      deposit_rules: null,
      cancellation_rules: null,
    })).toMatchObject({
      currency: 'PHP',
      timezone: 'Asia/Manila',
      name: 'JRY Rentals',
    })
  })
})
