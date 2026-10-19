import { z } from 'zod'
import { parseWithSchema } from '../../../../../utils/validation'
import { defineApiHandler } from '../../../../utils/api'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { requireAdminClient } from '../../../../utils/admin'
import { collectAdminCommission } from '../../../../services/commission.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-commission:${profile.uuid}`, 40, 60_000)
  const uuid = parseWithSchema(z.string().uuid(), getRouterParam(event, 'uuid') || '')
  return collectAdminCommission(event, client, uuid)
})
