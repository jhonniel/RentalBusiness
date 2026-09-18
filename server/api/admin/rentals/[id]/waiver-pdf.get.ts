import { rentalIdentifierSchema } from '../../../../../utils/rental-validation'
import { parseWithSchema } from '../../../../../utils/validation'
import { defineApiHandler } from '../../../../utils/api'
import { requireAdminClient } from '../../../../utils/admin'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { sendAdminRentalWaiverPdf } from '../../../../services/waiver.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-waiver-pdf:${profile.uuid}`, 20, 60_000)
  const identifier = parseWithSchema(rentalIdentifierSchema, getRouterParam(event, 'id') || '')
  const download = ['1', 'true'].includes(String(getQuery(event).download || ''))
  return sendAdminRentalWaiverPdf(event, client, identifier, download)
})
