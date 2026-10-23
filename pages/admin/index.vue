<script setup lang="ts">
import type { AdminAnalytics } from '~/types/analytics'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Admin dashboard',
  path: '/admin',
})

const { formatMoney } = useCurrency()
const { data, error, pending } = await useFetch<AdminAnalytics>('/api/admin/analytics')
const hasData = computed(() => Boolean(data.value))
const remote = useRemoteState(error, pending, hasData)
const maxSales = computed(() => Math.max(1, ...(data.value?.salesByDay.map(point => point.value) ?? [0])))
const maxStatus = computed(() => Math.max(1, ...(data.value?.rentalsByStatus.map(point => point.value) ?? [0])))
const maxCommission = computed(() => Math.max(1, ...(data.value?.commissionerRanks.map(rank => rank.commissionAmount) ?? [0])))

const cards = computed(() => {
  const kpis = data.value?.kpis
  return [
    { label: 'Total Sales', value: kpis ? formatMoney(kpis.totalSales) : '—' },
    { label: 'Today\'s Sales', value: kpis ? formatMoney(kpis.todaySales) : '—' },
    { label: 'This Month\'s Sales', value: kpis ? formatMoney(kpis.monthSales) : '—' },
    { label: 'Pending Rentals', value: kpis ? String(kpis.pendingRentals) : '—' },
    { label: 'Active Rentals', value: kpis ? String(kpis.activeRentals) : '—' },
    { label: 'Upcoming Rentals', value: kpis ? String(kpis.upcomingRentals) : '—' },
    { label: 'Overdue Rentals', value: kpis ? String(kpis.overdueRentals) : '—' },
    { label: 'Total Expenses', value: kpis ? formatMoney(kpis.totalExpenses) : '—' },
    { label: 'Net Revenue', value: kpis ? formatMoney(kpis.netRevenue) : '—' },
    { label: 'Total Customers', value: kpis ? String(kpis.totalCustomers) : '—' },
    { label: 'Inventory Value', value: kpis ? formatMoney(kpis.inventoryValue) : '—' },
  ]
})
</script>

<template>
  <div class="w-full space-y-8">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Operations
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        Dashboard
      </h2>
      <p class="mt-2 text-sm text-stone-600">
        Sales, rental load, commissioner rankings, and most-rented equipment. Totals are computed on the server in Asia/Manila.
      </p>
    </div>

    <AdminNotice
      v-if="remote.unavailable"
      title="Analytics are not connected"
      description="Add live Supabase credentials to load operations KPIs."
    />

    <AdminNotice
      v-else-if="remote.failed"
      tone="alert"
      title="Analytics could not load"
      description="Try again in a moment. Operations KPIs will appear when the request succeeds."
    />

    <template v-else>
      <div
        v-if="remote.loading"
        class="flex w-full flex-wrap gap-3"
        role="status"
        aria-busy="true"
      >
        <USkeleton
          v-for="index in 11"
          :key="index"
          class="h-24 w-full sm:w-auto sm:min-w-[14rem] sm:flex-1 sm:basis-[14rem]"
        />
      </div>

      <div
        v-else
        class="flex w-full flex-wrap gap-3"
      >
        <article
          v-for="card in cards"
          :key="card.label"
          class="w-full min-w-0 rounded-xl border border-stone-200 bg-white p-4 sm:w-auto sm:min-w-[14rem] sm:flex-1 sm:basis-[14rem]"
        >
          <p class="text-xs uppercase tracking-wider text-stone-500">
            {{ card.label }}
          </p>
          <p class="mt-3 text-2xl text-stone-900">
            {{ card.value }}
          </p>
        </article>
      </div>

      <section class="rounded-xl border border-stone-200 bg-white p-5">
        <h3 class="text-sm font-medium text-stone-900">
          Commissioners by commission
        </h3>
        <p class="mt-1 text-xs text-stone-500">
          Ranked from the highest commission to the lowest. A booking counts once it is approved.
        </p>
        <ol
          v-if="data?.commissionerRanks.length"
          class="mt-4 space-y-3"
        >
          <li
            v-for="(rank, index) in data.commissionerRanks"
            :key="rank.uuid"
            class="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[2rem_minmax(0,1fr)_8rem_auto]"
          >
            <span class="text-sm font-medium text-stone-500">{{ index + 1 }}</span>
            <span class="min-w-0">
              <span class="block truncate text-sm text-stone-900">{{ rank.firstName }} {{ rank.lastName }}</span>
              <span class="text-xs text-stone-500">{{ rank.bookings }} booking{{ rank.bookings === 1 ? '' : 's' }}</span>
            </span>
            <span class="col-start-2 h-2 overflow-hidden rounded-full bg-stone-100 sm:col-start-auto">
              <span
                class="chart-grow-x chart-width block h-full rounded-full bg-lumen-700"
                :style="{ width: `${Math.round((rank.commissionAmount / maxCommission) * 100)}%`, animationDelay: `${index * 60}ms` }"
              />
            </span>
            <span class="col-start-2 text-sm text-stone-900 sm:col-start-auto sm:text-right">{{ formatMoney(rank.commissionAmount) }}</span>
          </li>
        </ol>
        <p
          v-else
          class="mt-4 text-sm text-stone-500"
        >
          Commissioner rankings will appear after a commissioner booking is approved.
        </p>
      </section>

      <div class="grid w-full gap-4 lg:grid-cols-3">
        <section class="rounded-xl border border-stone-200 bg-white p-5">
          <h3 class="text-sm font-medium text-stone-900">
            Sales · 14 days
          </h3>
          <ul class="mt-4 space-y-2">
            <li
              v-for="(point, index) in data?.salesByDay"
              :key="point.label"
              class="grid grid-cols-[minmax(0,3.25rem)_minmax(0,1fr)_auto] items-center gap-2 text-xs"
            >
              <span class="text-stone-500">{{ point.label.slice(5) }}</span>
              <span class="h-2 overflow-hidden rounded-full bg-stone-100">
                <span
                  class="chart-grow-x chart-width block h-full rounded-full bg-lumen-700"
                  :style="{ width: `${Math.round((point.value / maxSales) * 100)}%`, animationDelay: `${index * 40}ms` }"
                />
              </span>
              <span>{{ formatMoney(point.value) }}</span>
            </li>
          </ul>
        </section>

        <section class="rounded-xl border border-stone-200 bg-white p-5">
          <h3 class="text-sm font-medium text-stone-900">
            Rentals by status
          </h3>
          <ul
            v-if="data?.rentalsByStatus.length"
            class="mt-4 space-y-2"
          >
            <li
              v-for="(point, index) in data.rentalsByStatus"
              :key="point.label"
              class="grid grid-cols-[minmax(0,4.5rem)_minmax(0,1fr)_auto] items-center gap-2 text-xs sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:gap-3"
            >
              <span class="capitalize text-stone-500">{{ point.label.replaceAll('_', ' ') }}</span>
              <span class="h-2 overflow-hidden rounded-full bg-stone-100">
                <span
                  class="chart-grow-x chart-width block h-full rounded-full bg-lumen-700"
                  :style="{ width: `${Math.round((point.value / maxStatus) * 100)}%`, animationDelay: `${index * 60}ms` }"
                />
              </span>
              <span>{{ point.value }}</span>
            </li>
          </ul>
          <p
            v-else
            class="mt-4 text-sm text-stone-500"
          >
            No rentals yet.
          </p>
        </section>

      <section class="rounded-xl border border-stone-200 bg-white p-5">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-sm font-medium text-stone-900">
            Expenses
          </h3>
          <NuxtLink
            to="/admin/expenses"
            class="text-xs text-lumen-700 hover:text-lumen-800"
          >
            View all
          </NuxtLink>
        </div>
        <p class="mt-1 text-xs text-stone-500">
          Voided costs stay listed and are left out of Total Expenses. Recurring costs appear here until their next date is posted.
        </p>
        <ul
          v-if="data?.recentExpenses.length || data?.recurringExpenses.length"
          class="mt-4 space-y-3"
        >
          <li
            v-for="expense in data.recentExpenses"
            :key="expense.uuid"
          >
            <NuxtLink
              :to="`/admin/expenses/${expense.uuid}`"
              class="flex items-center justify-between gap-3 text-sm"
            >
              <span class="min-w-0">
                <span class="block truncate text-stone-800">{{ expense.name }}</span>
                <span class="text-xs capitalize text-stone-500">{{ expense.status }} · {{ formatBusinessDate(expense.incurredOn) }}</span>
              </span>
              <span class="shrink-0 text-stone-900">{{ formatMoney(expense.amount) }}</span>
            </NuxtLink>
          </li>
          <li
            v-for="expense in data.recurringExpenses"
            :key="expense.uuid"
          >
            <NuxtLink
              :to="`/admin/expenses/recurring/${expense.uuid}`"
              class="flex items-center justify-between gap-3 text-sm"
            >
              <span class="min-w-0">
                <span class="block truncate text-stone-800">{{ expense.name }}</span>
                <span class="text-xs text-stone-500">Recurring · next {{ formatBusinessDate(expense.nextOccurrenceOn) }}</span>
              </span>
              <span class="shrink-0 text-stone-900">{{ formatMoney(expense.amount) }}</span>
            </NuxtLink>
          </li>
        </ul>
        <p
          v-else
          class="mt-4 text-sm text-stone-500"
        >
          No expenses yet.
        </p>
      </section>

      <section class="rounded-xl border border-stone-200 bg-white p-5">
        <h3 class="text-sm font-medium text-stone-900">
          Most-rented products
        </h3>
          <ul
            v-if="data?.topProducts.length"
            class="mt-4 divide-y divide-stone-100"
          >
            <li
              v-for="product in data.topProducts"
              :key="product.uuid"
              class="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <div class="min-w-0">
                <p class="font-medium break-words text-stone-900">
                  {{ product.name }}
                </p>
              </div>
              <p>{{ product.quantity }} rented</p>
            </li>
          </ul>
          <p
            v-else
            class="mt-4 text-sm text-stone-500"
          >
            Product demand will appear after rentals are created.
          </p>
        </section>
      </div>
    </template>
  </div>
</template>
