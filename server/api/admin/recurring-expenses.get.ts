import { recurringExpenseListQuerySchema } from '../../../utils/expense-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { requireAdminClient } from '../../utils/admin'
import { listAdminRecurringExpenses } from '../../services/expense.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  const query = parseWithSchema(recurringExpenseListQuerySchema, getQuery(event))
  return listAdminRecurringExpenses(client, query)
})
