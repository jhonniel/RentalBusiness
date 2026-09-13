import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { PublicBusinessSettings } from '../../types/settings'
import type { BusinessSettingsInput } from '../../utils/settings-validation'
import { emptyToNull, toPublicBusinessSettings } from '../../utils/settings'
import { findBusinessSettings, saveBusinessSettings } from '../repositories/business.repository'
import { recordAudit } from '../utils/audit'

type Client = SupabaseClient<Database>

export async function getAdminSettings(client: Client): Promise<PublicBusinessSettings> {
  return toPublicBusinessSettings(await findBusinessSettings(client))
}

export async function updateAdminSettings(
  event: H3Event,
  client: Client,
  input: BusinessSettingsInput,
): Promise<PublicBusinessSettings> {
  const previous = toPublicBusinessSettings(await findBusinessSettings(client))
  const row = await saveBusinessSettings(client, {
    name: input.name,
    email: emptyToNull(input.email),
    phone: emptyToNull(input.phone),
    address: emptyToNull(input.address),
    late_fee_policy: emptyToNull(input.lateFeePolicy),
    deposit_rules: emptyToNull(input.depositRules),
    cancellation_rules: emptyToNull(input.cancellationRules),
  })
  const next = toPublicBusinessSettings(row)

  await recordAudit(event, client, {
    action: 'settings.update',
    entity: 'business_profiles',
    entityId: next.uuid || 'business',
    previous: {
      name: previous.name,
      email: previous.email,
      phone: previous.phone,
      address: previous.address,
    },
    next: {
      name: next.name,
      email: next.email,
      phone: next.phone,
      address: next.address,
    },
  })

  return next
}
