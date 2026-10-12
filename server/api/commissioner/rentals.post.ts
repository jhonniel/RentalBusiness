import { createCommissionerRentalSchema } from '../../../utils/rental-validation'
import { parseWithSchema } from '../../../utils/validation'
import { createCommissionerRental } from '../../services/commissioner.service'
import { sendAdminWaiverInvite } from '../../services/waiver.service'
import { requireCommissionerClient } from '../../utils/commissioner'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'

export default defineApiHandler(async (event) => {
  const { profile, client, profileId } = await requireCommissionerClient(event)
  assertRateLimit(`commissioner-rental-create:${profile.uuid}`, 20, 60_000)
  const input = parseWithSchema(createCommissionerRentalSchema, await readBody(event))
  const rental = await createCommissionerRental(event, client, profile, profileId, input)
  try {
    const invite = await sendAdminWaiverInvite(event, client, profileId, rental.uuid, {})
    return {
      ...rental,
      waiverUrl: invite.waiverUrl,
    }
  }
  catch {
    return {
      ...rental,
      waiverUrl: null,
    }
  }
})
