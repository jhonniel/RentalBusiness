import { publishWaiverSchema } from '../../../utils/waiver-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { requireAdminClient } from '../../utils/admin'
import { publishWaiverVersion } from '../../services/waiver.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-waivers:${profile.uuid}`, 40, 60_000)
  const input = parseWithSchema(publishWaiverSchema, await readBody(event))
  return publishWaiverVersion(event, client, input)
})
