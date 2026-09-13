import { receiptIdentifierSchema } from '../../../utils/receipt-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { getOwnReceipt } from '../../services/receipt.service'
import { requireUserClient } from '../../utils/user'

export default defineApiHandler(async (event) => {
  const { client } = await requireUserClient(event)
  const identifier = parseWithSchema(receiptIdentifierSchema, getRouterParam(event, 'id') || '')
  return getOwnReceipt(client, identifier)
})
