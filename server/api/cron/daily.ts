import { defineApiHandler } from '../../utils/api'
import { requireCronSecret } from '../../utils/cron'
import { runDailyJobs } from '../../services/cron.service'

export default defineApiHandler(async (event) => {
  requireCronSecret(event)
  return runDailyJobs(event)
})
