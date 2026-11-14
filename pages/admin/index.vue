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

const kpis = computed(() => data.value?.kpis)
const money = (value?: number) => value === undefined ? '—' : formatMoney(value)
const count = (value?: number) => value === undefined ? '—' : String(value)
</script>

<template>
  <div class="w-full space-y-6">
    <AdminPageHeader
      eyebrow="Operations"
      title="Dashboard"
      description="Sales, rental load, commissioner rankings, and most-rented equipment. Totals are computed on the server in Asia/Manila."
    />

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

    <AdminBento
      v-else-if="remote.loading"
      role="status"
      aria-busy="true"
    >
      <USkeleton class="col-span-2 h-36 rounded-2xl" />
      <USkeleton
        v-for="index in 10"
        :key="index"
        class="col-span-1 h-28 rounded-2xl"
      />
    </AdminBento>

    <AdminBento v-else>
      <AdminStat
        wide
        tone="dark"
        icon="i-lucide-trending-up"
        label="Actual sales · all time"
        :value="money(kpis?.totalSales)"
        hint="Paid rent after discounts, minus commissions and deposits held."
        to="/admin/sales"
      />
      <AdminStat
        label="Today"
        icon="i-lucide-sun"
        :value="money(kpis?.todaySales)"
        hint="Actual sales"
      />
      <AdminStat
        label="This month"
        icon="i-lucide-calendar-days"
        :value="money(kpis?.monthSales)"
        hint="Actual sales"
      />
      <AdminStat
        label="Net revenue"
        icon="i-lucide-wallet"
        tone="accent"
        :value="money(kpis?.netRevenue)"
        to="/admin/reports"
      />
      <AdminStat
        label="Expenses"
        icon="i-lucide-receipt"
        :value="money(kpis?.totalExpenses)"
        hint="Excludes commissions"
        to="/admin/expenses"
      />

      <AdminStat
        label="Pending"
        icon="i-lucide-hourglass"
        :value="count(kpis?.pendingRentals)"
        hint="Waiting for approval"
        to="/admin/rentals"
      />
      <AdminStat
        label="Active"
        icon="i-lucide-activity"
        :value="count(kpis?.activeRentals)"
        hint="Out with customers"
        to="/admin/rentals"
      />
      <AdminStat
        label="Upcoming"
        icon="i-lucide-calendar-clock"
        :value="count(kpis?.upcomingRentals)"
        to="/admin/calendar"
      />
      <AdminStat
        label="Overdue"
        icon="i-lucide-alarm-clock"
        :tone="(kpis?.overdueRentals ?? 0) > 0 ? 'warn' : 'default'"
        :value="count(kpis?.overdueRentals)"
        :hint="(kpis?.overdueRentals ?? 0) > 0 ? 'Needs follow-up' : 'All on time'"
        to="/admin/rentals"
      />
      <AdminStat
        label="Customers"
        icon="i-lucide-users"
        :value="count(kpis?.totalCustomers)"
        to="/admin/customers"
      />
      <AdminStat
        label="Inventory value"
        icon="i-lucide-boxes"
        :value="money(kpis?.inventoryValue)"
        to="/admin/inventory"
      />

      <AdminTile
        size="wide"
        title="Actual sales · 14 days"
        icon="i-lucide-chart-column"
        to="/admin/sales"
      >
        <ul class="space-y-2">
          <li
            v-for="(point, index) in data?.salesByDay"
            :key="point.label"
            class="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 text-xs"
          >
            <span class="text-stone-500">{{ point.label.slice(5) }}</span>
            <span class="h-2 overflow-hidden rounded-full bg-stone-100">
              <span
                class="chart-grow-x chart-width block h-full rounded-full bg-lumen-700"
                :style="{ width: `${Math.round((point.value / maxSales) * 100)}%`, animationDelay: `${index * 40}ms` }"
              />
            </span>
            <span class="tabular-nums">{{ formatMoney(point.value) }}</span>
          </li>
        </ul>
      </AdminTile>

      <AdminTile
        size="third"
        title="Rentals by status"
        icon="i-lucide-clipboard-list"
        to="/admin/rentals"
      >
        <ul
          v-if="data?.rentalsByStatus.length"
          class="space-y-2"
        >
          <li
            v-for="(point, index) in data.rentalsByStatus"
            :key="point.label"
            class="grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)_auto] items-center gap-2 text-xs"
          >
            <span class="truncate capitalize text-stone-500">{{ point.label.replaceAll('_', ' ') }}</span>
            <span class="h-2 overflow-hidden rounded-full bg-stone-100">
              <span
                class="chart-grow-x chart-width block h-full rounded-full bg-lumen-700"
                :style="{ width: `${Math.round((point.value / maxStatus) * 100)}%`, animationDelay: `${index * 60}ms` }"
              />
            </span>
            <span class="tabular-nums">{{ point.value }}</span>
          </li>
        </ul>
        <p
          v-else
          class="text-sm text-stone-500"
        >
          No rentals yet.
        </p>
      </AdminTile>

      <AdminTile
        size="half"
        title="Commissioners by commission"
        icon="i-lucide-hand-coins"
        description="Highest commission first. A booking counts once it is approved."
        to="/admin/commissioners"
      >
        <ol
          v-if="data?.commissionerRanks.length"
          class="space-y-3"
        >
          <li
            v-for="(rank, index) in data.commissionerRanks"
            :key="rank.uuid"
            class="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1"
          >
            <span class="text-sm font-medium text-stone-500">{{ index + 1 }}</span>
            <span class="min-w-0">
              <span class="block truncate text-sm text-stone-900">{{ rank.firstName }} {{ rank.lastName }}</span>
              <span class="text-xs text-stone-500">{{ rank.bookings }} booking{{ rank.bookings === 1 ? '' : 's' }}</span>
            </span>
            <span class="text-sm tabular-nums text-stone-900">{{ formatMoney(rank.commissionAmount) }}</span>
            <span class="col-span-2 col-start-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <span
                class="chart-grow-x chart-width block h-full rounded-full bg-lumen-700"
                :style="{ width: `${Math.round((rank.commissionAmount / maxCommission) * 100)}%`, animationDelay: `${index * 60}ms` }"
              />
            </span>
          </li>
        </ol>
        <p
          v-else
          class="text-sm text-stone-500"
        >
          Rankings appear after a commissioner booking is approved.
        </p>
      </AdminTile>

      <AdminTile
        size="half"
        title="Expenses"
        icon="i-lucide-receipt"
        description="Voided costs stay listed and are left out of totals."
        to="/admin/expenses"
      >
        <ul
          v-if="data?.recentExpenses.length || data?.recurringExpenses.length"
          class="divide-y divide-stone-100"
        >
          <li
            v-for="expense in data.recentExpenses"
            :key="expense.uuid"
          >
            <NuxtLink
              :to="`/admin/expenses/${expense.uuid}`"
              class="flex min-h-11 items-center justify-between gap-3 py-2 text-sm"
            >
              <span class="min-w-0">
                <span class="block truncate text-stone-800">{{ expense.name }}</span>
                <span class="text-xs capitalize text-stone-500">{{ expense.status }} · {{ formatBusinessDate(expense.incurredOn) }}</span>
              </span>
              <span class="shrink-0 tabular-nums text-stone-900">{{ formatMoney(expense.amount) }}</span>
            </NuxtLink>
          </li>
          <li
            v-for="expense in data.recurringExpenses"
            :key="expense.uuid"
          >
            <NuxtLink
              :to="`/admin/expenses/recurring/${expense.uuid}`"
              class="flex min-h-11 items-center justify-between gap-3 py-2 text-sm"
            >
              <span class="min-w-0">
                <span class="block truncate text-stone-800">{{ expense.name }}</span>
                <span class="text-xs text-stone-500">Recurring · next {{ formatBusinessDate(expense.nextOccurrenceOn) }}</span>
              </span>
              <span class="shrink-0 tabular-nums text-stone-900">{{ formatMoney(expense.amount) }}</span>
            </NuxtLink>
          </li>
        </ul>
        <p
          v-else
          class="text-sm text-stone-500"
        >
          No expenses yet.
        </p>
      </AdminTile>

      <AdminTile
        size="full"
        title="Most-rented products"
        icon="i-lucide-package"
        to="/admin/products"
      >
        <ul
          v-if="data?.topProducts.length"
          class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
        >
          <li
            v-for="(product, index) in data.topProducts"
            :key="product.uuid"
            class="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2.5 text-sm"
          >
            <span class="flex min-w-0 items-center gap-2">
              <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-stone-600">{{ index + 1 }}</span>
              <span class="truncate font-medium text-stone-900">{{ product.name }}</span>
            </span>
            <span class="shrink-0 text-xs text-stone-600">{{ product.quantity }} rented</span>
          </li>
        </ul>
        <p
          v-else
          class="text-sm text-stone-500"
        >
          Product demand will appear after rentals are created.
        </p>
      </AdminTile>
    </AdminBento>
  </div>
</template>
