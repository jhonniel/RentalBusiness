<script setup lang="ts">
import type { RecurringExpenseListResponse } from '~/types/expense'
import { EXPENSE_CATEGORIES, RECURRING_EXPENSE_STATUSES } from '~/utils/constants'
import { formatBusinessDate } from '~/utils/datetime'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Recurring expenses',
  path: '/admin/expenses/recurring',
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

const { data, error, pending } = await useFetch<RecurringExpenseListResponse>('/api/admin/recurring-expenses', {
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
          Recurring expenses
        </h2>
        <p class="mt-1 text-sm text-stone-600">
          Templates for subscriptions and other repeating costs. Cron generation starts in Phase 12.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          to="/admin/expenses"
          color="neutral"
          variant="outline"
        >
          One-time
        </UButton>
        <UButton to="/admin/expenses/recurring/new">
          Add recurring
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
        placeholder="Search name or vendor"
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
          v-for="item in RECURRING_EXPENSE_STATUSES"
          :key="item"
          :value="item"
        >
          {{ item }}
        </option>
      </select>
    </form>

    <AdminNotice
      v-if="unavailable"
      title="Recurring expenses are not connected"
      description="Add live Supabase credentials to manage recurring templates."
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
      title="No recurring expenses"
      description="Add a template such as Starlink or studio rent."
    />

    <ul
      v-else
      class="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white"
    >
      <li
        v-for="item in data.items"
        :key="item.uuid"
      >
        <NuxtLink
          :to="`/admin/expenses/recurring/${item.uuid}`"
          class="flex flex-col gap-3 px-4 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0">
            <p class="font-medium text-stone-900">
              {{ item.name }}
            </p>
            <p class="text-sm break-words text-stone-500">
              {{ item.frequency }}
              · next {{ formatBusinessDate(item.nextOccurrenceOn) }}
              · {{ item.occurrenceCount }} posted
            </p>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm">{{ formatMoney(item.amount) }}</span>
            <StatusBadge :status="item.status" />
          </div>
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
