import { reportQuerySchema, reportTypeSchema } from '../../../../utils/report-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { requireAdminClient } from '../../../utils/admin'
import { exportAdminReport, getAdminReport } from '../../../services/report.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  const type = parseWithSchema(reportTypeSchema, getRouterParam(event, 'type') || '')
  const query = parseWithSchema(reportQuerySchema, getQuery(event))

  if (query.format === 'csv') {
    assertRateLimit(`admin-report:${profile.uuid}`, 20, 60_000)
    return exportAdminReport(event, client, type, query)
  }

  return getAdminReport(client, type, query)
})
