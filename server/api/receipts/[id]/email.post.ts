import { receiptEmailSchema, receiptIdentifierSchema } from '../../../../utils/receipt-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { sendOwnReceiptCopy } from '../../../services/receipt.service'
import { requireUserClient } from '../../../utils/user'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireUserClient(event)
  assertRateLimit(`receipt-email:${profile.uuid}`, 8, 60_000)
  const identifier = parseWithSchema(receiptIdentifierSchema, getRouterParam(event, 'id') || '')
  const body = parseWithSchema(receiptEmailSchema, await readBody(event))
  return sendOwnReceiptCopy(event, client, identifier, body.email)
})
