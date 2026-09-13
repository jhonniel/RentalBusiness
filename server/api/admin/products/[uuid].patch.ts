import { productInputSchema } from '../../../../utils/product-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { requireAdminClient } from '../../../utils/admin'
import { defineApiHandler } from '../../../utils/api'
import { AppError, ERROR_CODES } from '../../../utils/errors'
import { assertRateLimit } from '../../../utils/rate-limit'
import { saveProduct } from '../../../services/catalog.service'

export default defineApiHandler(async (event) => {
  const uuid = getRouterParam(event, 'uuid')
  if (!uuid) {
    throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-catalog:${profile.uuid}`, 40, 60_000)
  const input = parseWithSchema(productInputSchema, await readBody(event))
  return saveProduct(event, client, input, uuid)
})
