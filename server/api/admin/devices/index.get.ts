import { registeredDeviceListQuerySchema } from '../../../../utils/registered-device-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { requireAdminClient } from '../../../utils/admin'
import { defineApiHandler } from '../../../utils/api'
import { getAdminRegisteredDevices } from '../../../services/registered-device.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  const query = parseWithSchema(registeredDeviceListQuerySchema, getQuery(event))
  return getAdminRegisteredDevices(client, query)
})
