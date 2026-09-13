<script setup lang="ts">
import type { ExpenseListResponse } from '~/types/expense'
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES } from '~/utils/constants'
import { formatBusinessDate } from '~/utils/datetime'

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

const { data, error, pending } = await useFetch<ExpenseListResponse>('/api/admin/expenses', {
  query,
  watch: [query],
})

const unavailable = computed(() => error.value?.statusCode === 503)
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / 20)))

watch([search, category, status], () => {
  page.value = 1
})
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
          Finance
        </p>
        <h2 class="mt-2 text-2xl font-medium text-stone-900">
          Expenses
        </h2>
        <p class="mt-1 text-sm text-stone-600">
          One-time costs. Voided rows stay on file and drop out of dashboard totals.
        </p>
      </div>
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
          class="flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-stone-50"
        >
          <div>
            <p class="font-medium text-stone-900">
              {{ expense.name }}
            </p>
            <p class="text-sm text-stone-500">
              {{ expense.category }}
              · {{ formatBusinessDate(expense.incurredOn) }}
              <span v-if="expense.vendor">· {{ expense.vendor }}</span>
            </p>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm">{{ formatMoney(expense.amount) }}</span>
            <StatusBadge :status="expense.status" />
          </div>
        </NuxtLink>
      </li>
    </ul>

    <div
      v-if="totalPages > 1"
      class="flex justify-end gap-2"
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
