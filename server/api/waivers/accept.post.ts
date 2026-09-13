import { acceptWaiverSchema } from '../../../utils/waiver-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { acceptWaiver } from '../../services/waiver.service'
import { requireUserClient } from '../../utils/user'

export default defineApiHandler(async (event) => {
  const { profile, client, profileId } = await requireUserClient(event)
  assertRateLimit(`waiver-accept:${profile.uuid}`, 20, 60_000)
  const input = parseWithSchema(acceptWaiverSchema, await readBody(event))
  return acceptWaiver(event, client, profileId, input, {
    email: profile.email,
    phone: profile.phone,
  })
})
