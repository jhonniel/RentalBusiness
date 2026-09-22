import { applyVoucherSchema } from '../../../../utils/voucher-validation'
import { rentalIdentifierSchema } from '../../../../utils/rental-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { requireUserClient } from '../../../utils/user'
import { applyOwnRentalVoucher } from '../../../services/voucher.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireUserClient(event)
  assertRateLimit(`rental-voucher:${profile.uuid}`, 20, 60_000)
  const identifier = parseWithSchema(rentalIdentifierSchema, getRouterParam(event, 'id') || '')
  const input = parseWithSchema(applyVoucherSchema, await readBody(event))
  return applyOwnRentalVoucher(event, client, identifier, input.code)
})
