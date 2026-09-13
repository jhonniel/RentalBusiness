import { updateProfileSchema } from '../../../utils/auth-validation'
import { CURRENT_PRIVACY_POLICY_VERSION } from '../../../utils/privacy-policy'
import { CURRENT_TERMS_VERSION } from '../../../utils/terms'
import { parseWithSchema } from '../../../utils/validation'
import { toPublicProfile } from '../../../utils/auth'
import { updateOwnProfile } from '../../repositories/profile.repository'
import { defineApiHandler } from '../../utils/api'
import { requireUser } from '../../utils/auth'
import { assertRateLimit } from '../../utils/rate-limit'
import { getAuthenticatedSupabaseClient, getSupabaseAdminClient } from '../../utils/supabase'

export default defineApiHandler(async (event) => {
  const user = await requireUser(event)
  assertRateLimit(`profile:${user.sub}`, 20, 60_000)

  const body = await readBody(event)
  const input = parseWithSchema(updateProfileSchema, body)
  const values = {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone ? input.phone : null,
    marketingOptIn: input.marketingOptIn,
    privacyPolicyVersion: input.privacyAcknowledged === true
      ? CURRENT_PRIVACY_POLICY_VERSION
      : undefined,
    termsVersion: input.termsAccepted === true
      ? CURRENT_TERMS_VERSION
      : undefined,
  }
  const client = await getAuthenticatedSupabaseClient(event)
  const row = await updateOwnProfile(client, user.sub, values).catch(() =>
    updateOwnProfile(getSupabaseAdminClient(), user.sub, values),
  )

  return toPublicProfile(
    row,
    typeof user.email === 'string' ? user.email : null,
    user.email_verified === true || Reflect.get(user, 'email_confirmed') === true,
  )
})
