import { adminAuditListQuerySchema } from '../../../utils/admin-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { requireAdminClient } from '../../utils/admin'
import { listAdminAuditLogs } from '../../services/audit.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  const query = parseWithSchema(adminAuditListQuerySchema, getQuery(event))
  return listAdminAuditLogs(client, query)
})
