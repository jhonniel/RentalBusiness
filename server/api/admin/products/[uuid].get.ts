import { requireAdminClient } from '../../../utils/admin'
import { defineApiHandler } from '../../../utils/api'
import { AppError, ERROR_CODES } from '../../../utils/errors'
import { getAdminProduct } from '../../../services/catalog.service'

export default defineApiHandler(async (event) => {
  const uuid = getRouterParam(event, 'uuid')
  if (!uuid) {
    throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const { client } = await requireAdminClient(event)
  return getAdminProduct(client, uuid)
})
