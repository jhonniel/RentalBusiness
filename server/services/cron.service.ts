import type { H3Event } from 'h3'
import { AppError, ERROR_CODES } from '../utils/errors'
import { logger } from '../utils/logger'
import { recordAudit } from '../utils/audit'
import { getSupabaseAdminClient } from '../utils/supabase'
import { calendarDateInZone } from '../../utils/datetime'
import {
  CRON_CATCH_UP_LIMIT,
  isOverdueRental,
  isPickupReminderDue,
  isRecurringExpenseDue,
  isReturnReminderDue,
  reminderOn,
} from '../../utils/cron'
import { canPostRecurringExpense } from '../../utils/expense'
import { canTransitionRentalStatus } from '../../utils/rental-status'
import { findRecurringExpenseIdentity, listDueRecurringIdentities } from '../repositories/expense.repository'
import { insertNotification } from '../repositories/notification.repository'
import {
  findRentalIdentity,
  insertRentalStatusHistory,
  listRentalsByDate,
  updateRentalStatus,
} from '../repositories/rental.repository'
import { postAdminOccurrence } from './expense.service'
import { sendRentalReminder } from './receipt.service'

function jobDate(today?: string) {
  return today || calendarDateInZone()
}

export async function runRecurringExpenseJob(event: H3Event, today = jobDate()) {
  const client = getSupabaseAdminClient()
  const due = await listDueRecurringIdentities(client, today)
  const summary = { considered: due.length, posted: 0, skipped: 0, failed: 0 }

  for (const template of due) {
    try {
      let current = template
      let cycles = 0

      while (
        cycles < CRON_CATCH_UP_LIMIT
        && canPostRecurringExpense(current.status)
        && isRecurringExpenseDue(current.next_occurrence_on, today, current.end_on, current.status)
      ) {
        await postAdminOccurrence(event, client, current.uuid)
        summary.posted += 1
        cycles += 1
        const next = await findRecurringExpenseIdentity(client, current.uuid)
        if (!next) {
          break
        }
        current = next
      }

      if (cycles === 0) {
        summary.skipped += 1
      }
    }
    catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODES.CONFLICT) {
        summary.skipped += 1
        continue
      }

      summary.failed += 1
      logger.warn('Recurring expense job skipped a template', {
        recurringExpenseUuid: template.uuid,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      })
    }
  }

  logger.info('Recurring expense job finished', summary)
  return { job: 'recurring-expenses', asOf: today, ...summary }
}

export async function runReminderJob(event: H3Event, today = jobDate()) {
  const client = getSupabaseAdminClient()
  const remindDate = reminderOn(today)
  const pickups = await listRentalsByDate(client, {
    statuses: ['paid', 'approved', 'ready_for_pickup'],
    column: 'starts_on',
    on: remindDate,
  })
  const returns = await listRentalsByDate(client, {
    statuses: ['active', 'overdue'],
    column: 'ends_on',
    on: remindDate,
  })

  const summary = { considered: 0, sent: 0, skipped: 0, failed: 0 }

  async function remind(rental: { uuid: string }, type: 'pickup' | 'return') {
    summary.considered += 1
    try {
      const result = await sendRentalReminder(event, { rentalUuid: rental.uuid, type })
      if (result.status === 'sent') {
        summary.sent += 1
      }
      else {
        summary.skipped += 1
      }
    }
    catch (error) {
      summary.failed += 1
      logger.warn('Rental reminder was not sent', {
        rentalUuid: rental.uuid,
        type,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      })
    }
  }

  for (const rental of pickups) {
    if (isPickupReminderDue(rental.status, rental.starts_on, remindDate)) {
      await remind(rental, 'pickup')
    }
  }

  for (const rental of returns) {
    if (isReturnReminderDue(rental.status, rental.ends_on, remindDate)) {
      await remind(rental, 'return')
    }
  }

  logger.info('Reminder job finished', summary)
  return { job: 'reminders', asOf: today, remindOn: remindDate, ...summary }
}

export async function runOverdueJob(event: H3Event, today = jobDate()) {
  const client = getSupabaseAdminClient()
  const rows = await listRentalsByDate(client, {
    statuses: ['active'],
    column: 'ends_on',
    on: today,
    before: true,
  })
  const summary = { considered: rows.length, marked: 0, skipped: 0, failed: 0 }

  for (const rental of rows) {
    if (!isOverdueRental(rental.status, rental.ends_on, today) || !canTransitionRentalStatus(rental.status, 'overdue')) {
      summary.skipped += 1
      continue
    }

    try {
      const identity = await findRentalIdentity(client, rental.uuid)
      if (!identity) {
        summary.skipped += 1
        continue
      }

      await updateRentalStatus(client, rental.uuid, 'overdue')
      await insertRentalStatusHistory(client, {
        rentalId: identity.id,
        fromStatus: rental.status,
        toStatus: 'overdue',
        note: 'Marked overdue by scheduled job.',
      })
      await insertNotification(client, {
        recipient_id: identity.customer_id,
        type: 'rental.overdue',
        title: 'Rental overdue',
        body: `Your rental ${rental.code} is now overdue. Please return the equipment.`,
        metadata: { rentalUuid: rental.uuid, rentalCode: rental.code },
      })
      await recordAudit(event, client, {
        action: 'rental.overdue',
        entity: 'rental_requests',
        entityId: rental.uuid,
        previous: { status: rental.status },
        next: { status: 'overdue' },
      })
      summary.marked += 1
    }
    catch (error) {
      summary.failed += 1
      logger.warn('Overdue job skipped a rental', {
        rentalUuid: rental.uuid,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      })
    }
  }

  logger.info('Overdue job finished', summary)
  return { job: 'overdue', asOf: today, ...summary }
}
