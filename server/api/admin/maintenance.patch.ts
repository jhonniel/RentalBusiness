import { maintenanceInputSchema } from '../../../utils/maintenance-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { requireAdminClient } from '../../utils/admin'
import { assertRateLimit } from '../../utils/rate-limit'
import { updateAdminMaintenance } from '../../services/maintenance.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-maintenance:${profile.uuid}`, 20, 60_000)
  const input = parseWithSchema(maintenanceInputSchema, await readBody(event))
  return updateAdminMaintenance(event, client, input)
})
