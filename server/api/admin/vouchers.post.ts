import { voucherInputSchema } from '../../../utils/voucher-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { requireAdminClient } from '../../utils/admin'
import { saveAdminVoucher } from '../../services/voucher.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-voucher:${profile.uuid}`, 40, 60_000)
  const input = parseWithSchema(voucherInputSchema, await readBody(event))
  return saveAdminVoucher(event, client, input)
})
