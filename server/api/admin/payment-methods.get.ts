import { defineApiHandler } from '../../utils/api'
import { requireAdminClient } from '../../utils/admin'
import { getAdminPaymentMethods } from '../../services/payment-method.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  return getAdminPaymentMethods(client)
})
