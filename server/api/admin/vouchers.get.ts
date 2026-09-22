import { voucherListQuerySchema } from '../../../utils/voucher-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { requireAdminClient } from '../../utils/admin'
import { listAdminVouchers } from '../../services/voucher.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  const query = parseWithSchema(voucherListQuerySchema, getQuery(event))
  return listAdminVouchers(client, query)
})
