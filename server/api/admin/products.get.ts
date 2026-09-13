import { productListQuerySchema } from '../../../utils/product-validation'
import { parseWithSchema } from '../../../utils/validation'
import { requireAdminClient } from '../../utils/admin'
import { defineApiHandler } from '../../utils/api'
import { getAdminProducts } from '../../services/catalog.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  const query = parseWithSchema(productListQuerySchema, getQuery(event))
  return getAdminProducts(client, query)
})
