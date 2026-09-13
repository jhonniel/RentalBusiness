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
  <div class="mx-auto max-w-6xl space-y-8">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Operations
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        Dashboard
      </h2>
      <p class="mt-2 max-w-2xl text-sm text-stone-600">
        Sales, rental load, and most-rented equipment. Totals are computed on the server in Asia/Manila.
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
        class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
        role="status"
        aria-busy="true"
      >
        <USkeleton
          v-for="index in 11"
          :key="index"
          class="h-24 w-full"
        />
      </div>

      <div
        v-else
        class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        <article
          v-for="card in cards"
          :key="card.label"
          class="rounded-xl border border-stone-200 bg-white p-4"
        >
          <p class="text-xs uppercase tracking-wider text-stone-500">
            {{ card.label }}
          </p>
          <p class="mt-3 text-2xl text-stone-900">
            {{ card.value }}
          </p>
        </article>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="rounded-xl border border-stone-200 bg-white p-5">
          <h3 class="text-sm font-medium text-stone-900">
            Sales · 14 days
          </h3>
          <ul class="mt-4 space-y-2">
            <li
              v-for="point in data?.salesByDay"
              :key="point.label"
              class="grid grid-cols-[minmax(0,4.5rem)_minmax(0,1fr)_auto] items-center gap-3 text-xs"
            >
              <span class="text-stone-500">{{ point.label.slice(5) }}</span>
              <span class="h-2 overflow-hidden rounded-full bg-stone-100">
                <span
                  class="block h-full rounded-full bg-lumen-700"
                  :style="{ width: `${Math.round((point.value / maxSales) * 100)}%` }"
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
              v-for="point in data.rentalsByStatus"
              :key="point.label"
              class="grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)_auto] items-center gap-3 text-xs sm:grid-cols-[8rem_minmax(0,1fr)_auto]"
            >
              <span class="capitalize text-stone-500">{{ point.label.replaceAll('_', ' ') }}</span>
              <span class="h-2 overflow-hidden rounded-full bg-stone-100">
                <span
                  class="block h-full rounded-full bg-lumen-700"
                  :style="{ width: `${Math.round((point.value / maxStatus) * 100)}%` }"
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
      </div>

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
              <p class="text-stone-500">
                {{ product.sku }}
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
    </template>
  </div>
</template>
