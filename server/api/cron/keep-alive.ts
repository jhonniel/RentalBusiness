import { defineApiHandler } from '../../utils/api'
import { requireCronSecret } from '../../utils/cron'
import { keepSupabaseAwake } from '../../services/cron.service'

export default defineApiHandler(async (event) => {
  requireCronSecret(event)
  return keepSupabaseAwake(undefined, true)
})
