import { requireAdminClient } from '../../../utils/admin'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { runRecurringExpenseJob } from '../../../services/cron.service'

export default defineApiHandler(async (event) => {
  const { profile } = await requireAdminClient(event)
  assertRateLimit(`admin-post-due-recurring:${profile.uuid}`, 6, 60_000)
  return runRecurringExpenseJob(event)
})
