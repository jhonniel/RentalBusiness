<script setup lang="ts">
import type { AdminAnalytics } from '~/types/analytics'
import { maskCountedAmount } from '~/utils/count-up'

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
const dayLabel = new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const compactMoney = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 1 })
const formatDay = (date: string) => dayLabel.format(new Date(`${date}T00:00:00Z`))
const formatDayTick = (date: string) => String(Number(date.slice(8, 10)))
const formatAxisMoney = (value: number) => compactMoney.format(value)
const STATUS_COLORS: Record<string, string> = {
  pending: '#d97706',
  awaiting_payment: '#f59e0b',
  paid: '#0284c7',
  approved: '#4f46e5',
  ready_for_pickup: '#7c3aed',
  active: '#0f766e',
  overdue: '#dc2626',
  returned: '#65a30d',
  completed: '#1e3a8a',
  cancelled: '#a8a29e',
  rejected: '#78716c',
  draft: '#d6d3d1',
}
const COMMISSIONER_CHART_LIMIT = 8
const commissionerBars = computed(() => (data.value?.commissionerRanks ?? []).slice(0, COMMISSIONER_CHART_LIMIT).map(rank => ({
  key: rank.uuid,
  label: `${rank.firstName} ${rank.lastName}`.trim(),
  value: rank.commissionAmount,
  hint: `${rank.bookings} booking${rank.bookings === 1 ? '' : 's'}`,
})))
const hiddenCommissioners = computed(() => Math.max(0, (data.value?.commissionerRanks.length ?? 0) - COMMISSIONER_CHART_LIMIT))

const kpis = computed(() => data.value?.kpis)
const salesVisible = useCookie('jry-admin-dashboard-sales-visible', {
  default: () => true,
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 365,
})
const money = (value?: number) => value === undefined ? '—' : formatMoney(value)
const salesMoney = (value?: number) => salesVisible.value ? money(value) : maskCountedAmount(money(value))
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
        label="Actual sales · all time"
        :value="salesMoney(kpis?.totalSales)"
        hint="Paid rent after discounts, minus commissions and deposits held."
        to="/admin/sales"
      >
        <template #corner>
          <button
            type="button"
            class="inline-flex size-11 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            :aria-pressed="salesVisible"
            :aria-label="salesVisible ? 'Hide sales numbers' : 'Show sales numbers'"
            @click.stop="salesVisible = !salesVisible"
          >
            <UIcon
              :name="salesVisible ? 'i-lucide-eye' : 'i-lucide-eye-off'"
              class="size-4"
            />
          </button>
        </template>
      </AdminStat>
      <AdminStat
        label="Today"
        icon="i-lucide-sun"
        :value="salesMoney(kpis?.todaySales)"
        hint="Actual sales"
      />
      <AdminStat
        label="This month"
        icon="i-lucide-calendar-days"
        :value="salesMoney(kpis?.monthSales)"
        hint="Actual sales"
      />
      <AdminStat
        label="Net revenue"
        icon="i-lucide-wallet"
        tone="accent"
        :value="salesMoney(kpis?.netRevenue)"
        to="/admin/reports"
      />
      <AdminStat
        label="All spending"
        icon="i-lucide-receipt"
        :value="salesMoney(kpis?.totalSpent)"
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
        :value="salesMoney(kpis?.inventoryValue)"
        to="/admin/inventory"
      />

      <AdminTile
        size="wide"
        title="Actual sales · 14 days"
        icon="i-lucide-chart-line"
        to="/admin/sales"
      >
        <AdminLineChart
          v-if="data?.salesByDay.length"
          :points="data.salesByDay"
          :format="formatMoney"
          :format-axis="formatAxisMoney"
          :format-label="formatDay"
          :format-tick="formatDayTick"
          :concealed="!salesVisible"
        />
      </AdminTile>

      <AdminTile
        size="third"
        title="Rentals by status"
        icon="i-lucide-clipboard-list"
        to="/admin/rentals"
      >
        <AdminDonutChart
          v-if="data?.rentalsByStatus.length"
          :points="data.rentalsByStatus"
          :colors="STATUS_COLORS"
          total-label="Rentals"
        />
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
        <template v-if="commissionerBars.length">
          <AdminBarChart
            :points="commissionerBars"
            :total-label="hiddenCommissioners ? `Top ${COMMISSIONER_CHART_LIMIT} total` : 'Total commission'"
            :format="formatMoney"
            :format-axis="formatAxisMoney"
            :concealed="!salesVisible"
          />
          <p
            v-if="hiddenCommissioners"
            class="mt-3 text-xs text-stone-500"
          >
            Top {{ COMMISSIONER_CHART_LIMIT }} shown. {{ hiddenCommissioners }} more on the commissioners page.
          </p>
        </template>
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
              <span class="shrink-0 tabular-nums text-stone-900"><AdminCount :value="salesMoney(expense.amount)" /></span>
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
              <span class="shrink-0 tabular-nums text-stone-900"><AdminCount :value="salesMoney(expense.amount)" /></span>
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
            <span class="shrink-0 text-xs text-stone-600"><AdminCount :value="String(product.quantity)" /> rented</span>
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
