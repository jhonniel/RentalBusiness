import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { AdminCommission, AdminCommissionsResponse } from '../../types/commission'
import { canCollectCommission, isCommissionEarned, summarizeCommissions } from '../../utils/commission'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { findCommissionExpense, listCommissionExpenses, updateExpenseByUuid } from '../repositories/expense.repository'

type Client = SupabaseClient<Database>

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null
  }
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function listAdminCommissions(client: Client): Promise<AdminCommissionsResponse> {
  const rows = await listCommissionExpenses(client)
  const items: AdminCommission[] = rows.flatMap((row) => {
    const rental = first(row.rental)
    const commissioner = first(rental?.commissioner)
    if (!rental || !commissioner || !isCommissionEarned(rental.status)) {
      return []
    }

    const items = Array.isArray(rental.rental_items) ? rental.rental_items : []
    const equipment = items
      .map(item => first(item.products)?.name)
      .filter((name): name is string => Boolean(name))
      .join(', ')

    return [{
      uuid: row.uuid,
      amount: Number(row.amount),
      status: row.status === 'paid' ? 'collected' : 'unclaimed',
      earnedOn: row.incurred_on,
      collectedAt: row.status === 'paid' ? row.updated_at : null,
      rental: {
        uuid: rental.uuid,
        code: rental.code,
        pickupAt: rental.pickup_at,
        returnAt: rental.return_at,
        equipment: equipment || 'Equipment',
      },
      commissioner: {
        uuid: commissioner.uuid,
        firstName: commissioner.first_name,
        lastName: commissioner.last_name,
      },
    }]
  })

  return {
    summary: summarizeCommissions(items),
    unclaimed: items.filter(item => item.status === 'unclaimed'),
    collected: items.filter(item => item.status === 'collected'),
  }
}

export async function collectAdminCommission(event: H3Event, client: Client, uuid: string) {
  const expense = await findCommissionExpense(client, uuid)
  const rental = first(expense?.rental)
  if (!expense) {
    throw new AppError('Commission not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  if (expense.status === 'paid') {
    throw new AppError('That commission is already marked collected.', 409, ERROR_CODES.CONFLICT)
  }

  if (!canCollectCommission(expense.status, rental?.status)) {
    throw new AppError('A commission can be collected only after the booking is completed.', 409, ERROR_CODES.CONFLICT)
  }

  await updateExpenseByUuid(client, expense.uuid, { status: 'paid' })
  await recordAudit(event, client, {
    action: 'commission.collect',
    entity: 'expenses',
    entityId: expense.uuid,
    previous: { status: expense.status, rentalCode: rental?.code ?? null },
    next: { status: 'paid', amount: Number(expense.amount), rentalCode: rental?.code ?? null },
  })

  return { collected: true, uuid: expense.uuid }
}
