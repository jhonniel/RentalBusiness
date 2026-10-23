import { availabilityCalendarQuerySchema } from '../../../../utils/product-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { getProductAvailabilityCalendar } from '../../../services/availability.service'
import { requireCommissionerClient } from '../../../utils/commissioner'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireCommissionerClient(event)
  assertRateLimit(`commissioner-calendar:${profile.uuid}`, 80, 60_000)
  const query = parseWithSchema(availabilityCalendarQuerySchema, getQuery(event))
  return getProductAvailabilityCalendar(client, { ...query, confirmedOnly: true })
})
