import { paymentIdentifierSchema } from '../../../utils/payment-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { getOwnPayment } from '../../services/payment.service'
import { requireUserClient } from '../../utils/user'

export default defineApiHandler(async (event) => {
  const { client } = await requireUserClient(event)
  const uuid = parseWithSchema(paymentIdentifierSchema, getRouterParam(event, 'id') || '')
  return getOwnPayment(client, uuid)
})
