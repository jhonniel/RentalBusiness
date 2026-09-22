import { voucherInputSchema } from '../../../../utils/voucher-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { requireAdminClient } from '../../../utils/admin'
import { AppError, ERROR_CODES } from '../../../utils/errors'
import { saveAdminVoucher } from '../../../services/voucher.service'

export default defineApiHandler(async (event) => {
  const uuid = getRouterParam(event, 'uuid')
  if (!uuid) {
    throw new AppError('Voucher not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-voucher:${profile.uuid}`, 40, 60_000)
  const input = parseWithSchema(voucherInputSchema, await readBody(event))
  return saveAdminVoucher(event, client, input, uuid)
})
