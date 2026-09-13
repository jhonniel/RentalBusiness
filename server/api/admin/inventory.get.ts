import { inventoryListQuerySchema } from '../../../utils/product-validation'
import { parseWithSchema } from '../../../utils/validation'
import { requireAdminClient } from '../../utils/admin'
import { defineApiHandler } from '../../utils/api'
import { getInventory } from '../../services/catalog.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  const query = parseWithSchema(inventoryListQuerySchema, getQuery(event))
  return getInventory(client, query)
})
