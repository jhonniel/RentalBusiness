import { productInputSchema } from '../../../utils/product-validation'
import { parseWithSchema } from '../../../utils/validation'
import { requireAdminClient } from '../../utils/admin'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { saveProduct } from '../../services/catalog.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-catalog:${profile.uuid}`, 40, 60_000)
  const input = parseWithSchema(productInputSchema, await readBody(event))
  return saveProduct(event, client, input)
})
