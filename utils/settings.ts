import type { PublicBusinessSettings } from '~/types/settings'
import { APP_NAME, BUSINESS_CURRENCY, BUSINESS_TIMEZONE } from './constants'

export interface BusinessProfileRow {
  uuid: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  currency: string
  timezone: string
  late_fee_policy: string | null
  deposit_rules: string | null
  cancellation_rules: string | null
}

export function toPublicBusinessSettings(row?: Partial<BusinessProfileRow> | null): PublicBusinessSettings {
  return {
    uuid: row?.uuid ?? null,
    name: row?.name || APP_NAME,
    email: row?.email ?? null,
    phone: row?.phone ?? null,
    address: row?.address ?? null,
    currency: BUSINESS_CURRENCY,
    timezone: BUSINESS_TIMEZONE,
    lateFeePolicy: row?.late_fee_policy ?? null,
    depositRules: row?.deposit_rules ?? null,
    cancellationRules: row?.cancellation_rules ?? null,
  }
}

export function emptyToNull(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
