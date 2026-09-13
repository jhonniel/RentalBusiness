import { expenseIdentifierSchema } from '../../../../../utils/expense-validation'
import { parseWithSchema } from '../../../../../utils/validation'
import { defineApiHandler } from '../../../../utils/api'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { requireAdminClient } from '../../../../utils/admin'
import { endAdminRecurringExpense } from '../../../../services/expense.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-expense:${profile.uuid}`, 40, 60_000)
  const uuid = parseWithSchema(expenseIdentifierSchema, getRouterParam(event, 'id') || '')
  return endAdminRecurringExpense(event, client, uuid)
})
