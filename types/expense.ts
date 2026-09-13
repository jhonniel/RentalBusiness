import type { ExpenseCategory, ExpenseFrequency, ExpenseStatus, RecurringExpenseStatus } from '~/utils/constants'

export interface PublicExpense {
  uuid: string
  name: string
  category: ExpenseCategory
  description: string | null
  amount: number
  vendor: string | null
  reference: string | null
  status: ExpenseStatus
  notes: string | null
  incurredOn: string
  createdAt: string
  updatedAt: string
}

export interface ExpenseListResponse {
  items: PublicExpense[]
  page: number
  pageSize: number
  total: number
}

export interface PublicExpenseOccurrence {
  uuid: string
  occursOn: string
  generatedAt: string
  expense: Pick<PublicExpense, 'uuid' | 'name' | 'amount' | 'status' | 'incurredOn'> | null
}

export interface PublicRecurringExpense {
  uuid: string
  name: string
  category: ExpenseCategory
  amount: number
  frequency: ExpenseFrequency
  intervalCount: number
  anchorDay: number | null
  startOn: string
  endOn: string | null
  nextOccurrenceOn: string
  vendor: string | null
  status: RecurringExpenseStatus
  notes: string | null
  occurrenceCount: number
  occurrences?: PublicExpenseOccurrence[]
  createdAt: string
  updatedAt: string
}

export interface RecurringExpenseListResponse {
  items: PublicRecurringExpense[]
  page: number
  pageSize: number
  total: number
}

export interface ExpenseOccurrenceListResponse {
  items: PublicExpenseOccurrence[]
  page: number
  pageSize: number
  total: number
}
