import { expenseIdentifierSchema, occurrenceListQuerySchema } from '../../../../../utils/expense-validation'
import { parseWithSchema } from '../../../../../utils/validation'
import { defineApiHandler } from '../../../../utils/api'
import { requireAdminClient } from '../../../../utils/admin'
import { listAdminOccurrences } from '../../../../services/expense.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  const uuid = parseWithSchema(expenseIdentifierSchema, getRouterParam(event, 'id') || '')
  const query = parseWithSchema(occurrenceListQuerySchema, getQuery(event))
  return listAdminOccurrences(client, uuid, query)
})
