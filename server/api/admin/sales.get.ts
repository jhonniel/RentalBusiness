import { reportQuerySchema } from '../../../utils/report-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { requireAdminClient } from '../../utils/admin'
import { exportAdminReport, getAdminReport } from '../../services/report.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  const query = parseWithSchema(reportQuerySchema, getQuery(event))

  if (query.format === 'csv') {
    assertRateLimit(`admin-report:${profile.uuid}`, 20, 60_000)
    return exportAdminReport(event, client, 'sales', query)
  }

  return getAdminReport(client, 'sales', query)
})
