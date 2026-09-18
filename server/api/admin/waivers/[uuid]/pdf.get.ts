import { z } from 'zod'
import { parseWithSchema } from '../../../../../utils/validation'
import { defineApiHandler } from '../../../../utils/api'
import { requireAdminClient } from '../../../../utils/admin'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { sendAdminWaiverVersionPdf } from '../../../../services/waiver.service'

const uuidSchema = z.string().uuid('Waiver version not found.')

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-waiver-pdf:${profile.uuid}`, 20, 60_000)
  const uuid = parseWithSchema(uuidSchema, getRouterParam(event, 'uuid') || '')
  const download = ['1', 'true'].includes(String(getQuery(event).download || ''))
  return sendAdminWaiverVersionPdf(event, client, uuid, download)
})
