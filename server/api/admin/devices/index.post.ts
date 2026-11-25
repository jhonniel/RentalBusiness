import { registeredDeviceInputSchema } from '../../../../utils/registered-device-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { requireAdminClient } from '../../../utils/admin'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { saveRegisteredDevice } from '../../../services/registered-device.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-devices:${profile.uuid}`, 40, 60_000)
  const input = parseWithSchema(registeredDeviceInputSchema, await readBody(event))
  return saveRegisteredDevice(event, client, input)
})
