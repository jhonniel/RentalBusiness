import { rentalReminderSchema } from '../../../../utils/receipt-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { requireAdminClient } from '../../../utils/admin'
import { sendRentalReminder } from '../../../services/receipt.service'

export default defineApiHandler(async (event) => {
  const { profile } = await requireAdminClient(event)
  assertRateLimit(`admin-remind:${profile.uuid}`, 20, 60_000)
  const input = parseWithSchema(rentalReminderSchema, await readBody(event))
  return sendRentalReminder(event, input)
})
