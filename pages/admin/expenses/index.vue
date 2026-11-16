<script setup lang="ts">
import type { ExpenseListResponse, RecurringExpenseListResponse } from '~/types/expense'
import type { AdminReport } from '~/types/report'
import type { ReportPeriod } from '~/utils/report'
import { reportPeriodRange } from '~/utils/report'
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES } from '~/utils/constants'
import { calendarDateInZone, formatBusinessDate } from '~/utils/datetime'
import { monthlyEquivalent, recurrenceLabel } from '~/utils/expense'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Expenses',
  path: '/admin/expenses',
})

const searchInput = ref('')
const search = refDebounced(searchInput, 300)
const category = ref('')
const status = ref('')
const page = ref(1)
const { formatMoney } = useCurrency()

const query = computed(() => ({
  search: search.value || undefined,
  category: category.value || undefined,
  status: status.value || undefined,
  page: page.value,
  pageSize: 20,
}))

const { data, error, pending, refresh } = await useFetch<ExpenseListResponse>('/api/admin/expenses', {
  query,
  watch: [query],
})

const period = ref<ReportPeriod>('this_month')
const periodQuery = computed(() => reportPeriodRange(period.value))
const { data: overview, pending: overviewPending, refresh: refreshOverview } = useLazyFetch<Extract<AdminReport, { type: 'expenses' }>>('/api/admin/reports/expenses', {
  query: periodQuery,
  watch: [periodQuery],
})

const { data: recurring, pending: recurringPending, refresh: refreshRecurring } = useLazyFetch<RecurringExpenseListResponse>('/api/admin/recurring-expenses', {
  query: { status: 'active', pageSize: 50 },
})
const today = calendarDateInZone()
const recurringItems = computed(() => [...(recurring.value?.items ?? [])].sort((left, right) => left.nextOccurrenceOn.localeCompare(right.nextOccurrenceOn)))
const overdueRecurring = computed(() => recurringItems.value.filter(item => item.nextOccurrenceOn <= today))
const postingDue = ref(false)
const toast = useToast()

async function postDueRecurring() {
  postingDue.value = true
  try {
    const result = await $fetch<{ posted: number, failed: number }>('/api/admin/recurring-expenses/post-due', { method: 'POST' })
    toast.add({
      title: result.posted ? `${result.posted} recurring bill${result.posted === 1 ? '' : 's'} added to All expenses` : 'No recurring bills were due',
      description: result.failed ? `${result.failed} could not be posted. Open it to check.` : undefined,
      color: result.failed ? 'warning' : 'success',
    })
    await Promise.all([refresh(), refreshRecurring(), refreshOverview()])
  }
  catch (caught) {
    const payload = typeof caught === 'object' && caught && 'data' in caught
      ? (caught as { data?: { message?: string } }).data
      : null
    toast.add({ title: payload?.message || 'We could not post the due bills.', color: 'error' })
  }
  finally {
    postingDue.value = false
  }
}
const recurringMonthly = computed(() => recurringItems.value.reduce((sum, item) => sum + monthlyEquivalent(item.amount, item.frequency, item.intervalCount), 0))

const unavailable = computed(() => error.value?.statusCode === 503)
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / 20)))

watch([search, category, status], () => {
  page.value = 1
})
</script>

<template>
  <div class="w-full space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <AdminPageHeader
        eyebrow="Finance"
        title="Expenses"
        description="One-time costs and posted recurring bills. Voided rows stay on file and drop out of dashboard totals."
      />
      <div class="flex flex-wrap gap-2">
        <UButton
          to="/admin/expenses/recurring"
          color="neutral"
          variant="outline"
        >
          Recurring
        </UButton>
        <UButton to="/admin/expenses/new">
          Add expense
        </UButton>
      </div>
    </div>

    <AdminExpenseDashboard
      v-if="!unavailable"
      v-model:period="period"
      :report="overview ?? null"
      :loading="overviewPending"
    />

    <AdminTile
      v-if="!unavailable"
      size="full"
      title="Recurring expenses"
      icon="i-lucide-repeat"
      :description="recurringItems.length ? `${recurringItems.length} active · about ${formatMoney(recurringMonthly)} a month. Each one is added to All expenses automatically on its date.` : 'Bills that repeat, like internet or rent. Each one is added to All expenses automatically on its date.'"
      to="/admin/expenses/recurring"
      link-label="Manage"
    >
      <div
        v-if="overdueRecurring.length"
        class="mb-3 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"
      >
        <span>
          {{ overdueRecurring.length }} recurring bill{{ overdueRecurring.length === 1 ? ' is' : 's are' }} due and not in All expenses yet. They are usually added by the daily job.
        </span>
        <UButton
          size="sm"
          color="warning"
          icon="i-lucide-calendar-plus"
          :loading="postingDue"
          class="shrink-0 justify-center"
          @click="postDueRecurring"
        >
          Post due bills
        </UButton>
      </div>
      <div
        v-if="recurringPending && !recurring"
        class="space-y-2"
      >
        <USkeleton class="h-12 w-full" />
        <USkeleton class="h-12 w-full" />
      </div>
      <div
        v-else-if="!recurringItems.length"
        class="flex flex-col items-start gap-3 rounded-xl bg-stone-50 p-4 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between"
      >
        <span>No active recurring expenses.</span>
        <UButton
          to="/admin/expenses/recurring/new"
          size="sm"
          icon="i-lucide-plus"
        >
          Add recurring expense
        </UButton>
      </div>
      <ul
        v-else
        class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
      >
        <li
          v-for="item in recurringItems"
          :key="item.uuid"
          class="min-w-0"
        >
          <NuxtLink
            :to="`/admin/expenses/recurring/${item.uuid}`"
            class="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-stone-200 px-3 py-3 hover:border-stone-300 hover:bg-stone-50"
          >
            <span class="min-w-0">
              <span class="block text-sm font-medium break-words text-stone-900">{{ item.name }}</span>
              <span class="block text-xs break-words text-stone-500">
                {{ recurrenceLabel(item.frequency, item.intervalCount) }} ·
                <span :class="item.nextOccurrenceOn < today ? 'font-medium text-amber-700' : ''">{{ item.nextOccurrenceOn < today ? 'due since' : 'next' }} {{ formatBusinessDate(item.nextOccurrenceOn) }}</span>
              </span>
              <span class="block truncate text-xs capitalize text-stone-400">{{ item.category }}{{ item.vendor ? ` · ${item.vendor}` : '' }}</span>
            </span>
            <span class="shrink-0 text-sm font-medium tabular-nums text-stone-900">{{ formatMoney(item.amount) }}</span>
          </NuxtLink>
        </li>
      </ul>
    </AdminTile>

    <h3 class="text-sm font-medium text-stone-900">
      All expenses
    </h3>

    <form
      class="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-3"
      method="get"
      @submit.prevent
    >
      <input
        v-model="searchInput"
        class="rounded-md border border-stone-200 px-3 py-2 text-sm"
        placeholder="Search name, vendor, or reference"
      >
      <select
        v-model="category"
        class="rounded-md border border-stone-200 px-3 py-2 text-sm"
      >
        <option value="">
          All categories
        </option>
        <option
          v-for="item in EXPENSE_CATEGORIES"
          :key="item"
          :value="item"
        >
          {{ item }}
        </option>
      </select>
      <select
        v-model="status"
        class="rounded-md border border-stone-200 px-3 py-2 text-sm"
      >
        <option value="">
          All statuses
        </option>
        <option
          v-for="item in EXPENSE_STATUSES"
          :key="item"
          :value="item"
        >
          {{ item }}
        </option>
      </select>
    </form>

    <AdminNotice
      v-if="unavailable"
      title="Expenses are not connected"
      description="Add live Supabase credentials to manage expenses."
    />

    <div
      v-else-if="pending && !data"
      class="space-y-3"
    >
      <USkeleton class="h-20 w-full" />
      <USkeleton class="h-20 w-full" />
    </div>

    <AdminNotice
      v-else-if="!data?.items.length"
      title="No expenses"
      description="Add a one-time cost or post a recurring occurrence."
    />

    <ul
      v-else
      class="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white"
    >
      <li
        v-for="expense in data.items"
        :key="expense.uuid"
      >
        <NuxtLink
          :to="`/admin/expenses/${expense.uuid}`"
          class="grid gap-3 px-4 py-4 hover:bg-stone-50 lg:grid-cols-[minmax(0,2fr)_auto_auto] lg:items-center"
        >
          <div class="min-w-0">
            <p class="font-medium text-stone-900">
              {{ expense.name }}
            </p>
            <p class="text-sm break-words text-stone-500">
              {{ expense.category }}
              · {{ formatBusinessDate(expense.incurredOn) }}
              <span v-if="expense.vendor">· {{ expense.vendor }}</span>
            </p>
          </div>
          <span class="text-sm">{{ formatMoney(expense.amount) }}</span>
          <StatusBadge :status="expense.status" />
        </NuxtLink>
      </li>
    </ul>

    <div
      v-if="totalPages > 1"
      class="flex flex-wrap justify-end gap-2"
    >
      <UButton
        color="neutral"
        variant="outline"
        :disabled="page <= 1"
        @click="page -= 1"
      >
        Previous
      </UButton>
      <UButton
        color="neutral"
        variant="outline"
        :disabled="page >= totalPages"
        @click="page += 1"
      >
        Next
      </UButton>
    </div>
  </div>
</template>
