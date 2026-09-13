import { expenseListQuerySchema } from '../../../utils/expense-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { requireAdminClient } from '../../utils/admin'
import { listAdminExpenses } from '../../services/expense.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  const query = parseWithSchema(expenseListQuerySchema, getQuery(event))
  return listAdminExpenses(client, query)
})
