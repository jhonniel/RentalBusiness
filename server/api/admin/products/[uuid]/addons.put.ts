import { productAddonLinksSchema } from '../../../../../utils/addon-validation'
import { parseWithSchema } from '../../../../../utils/validation'
import { requireAdminClient } from '../../../../utils/admin'
import { defineApiHandler } from '../../../../utils/api'
import { AppError, ERROR_CODES } from '../../../../utils/errors'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { setProductAddonLinks } from '../../../../services/addon.service'
import { findProductIdByUuid } from '../../../../repositories/product.repository'

export default defineApiHandler(async (event) => {
  const uuid = getRouterParam(event, 'uuid')
  if (!uuid) {
    throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-product-addons:${profile.uuid}`, 40, 60_000)
  const input = parseWithSchema(productAddonLinksSchema, await readBody(event))
  const product = await findProductIdByUuid(client, uuid)
  if (!product) {
    throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const addonUuids = await setProductAddonLinks(event, client, product, input.addonUuids)
  return { addonUuids }
})
