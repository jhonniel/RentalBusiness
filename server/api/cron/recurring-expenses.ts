import { defineApiHandler } from '../../utils/api'
import { requireCronSecret } from '../../utils/cron'
import { runRecurringExpenseJob } from '../../services/cron.service'

export default defineApiHandler(async (event) => {
  requireCronSecret(event)
  return runRecurringExpenseJob(event)
})
