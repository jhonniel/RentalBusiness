import { defineApiHandler } from '../../utils/api'
import { requireCronSecret } from '../../utils/cron'
import { runOverdueJob } from '../../services/cron.service'

export default defineApiHandler(async (event) => {
  requireCronSecret(event)
  return runOverdueJob(event)
})
