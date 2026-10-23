import { rentalIdentifierSchema } from '../../../../utils/rental-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { getOwnRentalCalendar } from '../../../services/rental.service'
import { requireUserClient } from '../../../utils/user'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireUserClient(event)
  assertRateLimit(`rental-calendar:${profile.uuid}`, 40, 60_000)
  const identifier = parseWithSchema(rentalIdentifierSchema, getRouterParam(event, 'id') || '')
  return getOwnRentalCalendar(client, identifier)
})
