import { expenseIdentifierSchema } from '../../../../utils/expense-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { defineApiHandler } from '../../../utils/api'
import { requireAdminClient } from '../../../utils/admin'
import { getAdminExpense } from '../../../services/expense.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  const uuid = parseWithSchema(expenseIdentifierSchema, getRouterParam(event, 'id') || '')
  return getAdminExpense(client, uuid)
})
