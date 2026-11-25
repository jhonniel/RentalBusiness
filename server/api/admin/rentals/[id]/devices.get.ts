import { requireAdminClient } from '../../../../utils/admin'
import { defineApiHandler } from '../../../../utils/api'
import { AppError, ERROR_CODES } from '../../../../utils/errors'
import { getRentalAssignedDevices } from '../../../../services/registered-device.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  return getRentalAssignedDevices(client, id)
})
