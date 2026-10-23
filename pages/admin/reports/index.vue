<script setup lang="ts">
import type { AdminReport, ReportBarItem, ReportCharts, ReportType } from '~/types/report'
import { REPORT_TYPES } from '~/types/report'
import { calendarDateInZone } from '~/utils/datetime'
import { monthStart } from '~/utils/analytics'
import { monthBounds, monthKey } from '~/utils/calendar'
import { paymentMethodLabel } from '~/utils/report'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Reports',
  path: '/admin/reports',
})

const type = ref<ReportType>('overview')
const startsOn = ref(monthStart(calendarDateInZone()))
const endsOn = ref(monthBounds(monthKey(calendarDateInZone())).endsOn)
const { formatMoney } = useCurrency()

const query = computed(() => ({
  startsOn: startsOn.value,
  endsOn: endsOn.value,
}))

const { data, error, pending } = await useFetch<AdminReport>(
  () => `/api/admin/reports/${type.value}`,
  {
    query,
    watch: [type, query],
  },
)

const hasData = computed(() => Boolean(data.value))
const remote = useRemoteState(error, pending, hasData)
const csvHref = computed(() => {
  const params = new URLSearchParams({
    startsOn: startsOn.value,
    endsOn: endsOn.value,
    format: 'csv',
  })
  return `/api/admin/reports/${type.value}?${params.toString()}`
})

interface SummaryCard {
  label: string
  value: string
  hint?: string
  tone?: 'good' | 'bad'
}

function percent(value: number) {
  return `${Math.round(value * 1000) / 10}%`
}

function profitTone(value: number): SummaryCard['tone'] {
  return value < 0 ? 'bad' : value > 0 ? 'good' : undefined
}

const summaryCards = computed<SummaryCard[]>(() => {
  const report = data.value
  if (!report) {
    return []
  }

  if (report.type === 'overview') {
    const summary = report.summary
    return [
      { label: 'Sales', value: formatMoney(summary.sales), hint: `${summary.paidCount} paid payment${summary.paidCount === 1 ? '' : 's'}` },
      { label: 'Expenses', value: formatMoney(summary.otherExpenses), hint: 'Not counting commissions' },
      { label: 'Commissions', value: formatMoney(summary.commissions), hint: `${formatMoney(summary.unclaimedCommissions)} unclaimed · ${formatMoney(summary.collectedCommissions)} collected` },
      { label: 'Net profit', value: formatMoney(summary.profit), hint: `${percent(summary.margin)} of sales`, tone: profitTone(summary.profit) },
      { label: 'Bookings', value: String(summary.bookings), hint: 'Confirmed bookings starting in this range' },
      { label: 'Booking value', value: formatMoney(summary.bookedValue), hint: 'Rental totals, including unpaid extensions' },
      { label: 'Average booking', value: formatMoney(summary.averageBooking) },
      { label: 'Total costs', value: formatMoney(summary.expenses), hint: 'Expenses plus commissions' },
    ]
  }

  if (report.type === 'sales') {
    return [
      { label: 'Paid payments', value: String(report.summary.count) },
      { label: 'Sales', value: formatMoney(report.summary.total) },
      { label: 'Average payment', value: formatMoney(report.summary.average) },
    ]
  }

  if (report.type === 'expenses') {
    return [
      { label: 'Entries', value: String(report.summary.count), hint: 'Void entries are listed but not counted' },
      { label: 'Total', value: formatMoney(report.summary.total) },
      { label: 'Paid', value: formatMoney(report.summary.paid) },
      { label: 'Unpaid', value: formatMoney(report.summary.pending) },
      { label: 'Commissions', value: formatMoney(report.summary.commissions) },
      { label: 'Other expenses', value: formatMoney(report.summary.otherExpenses) },
    ]
  }

  if (report.type === 'commissions') {
    return [
      { label: 'Commissions', value: formatMoney(report.summary.total), hint: `${report.summary.count} booking${report.summary.count === 1 ? '' : 's'}` },
      { label: 'Unclaimed', value: formatMoney(report.summary.unclaimed) },
      { label: 'Collected', value: formatMoney(report.summary.collected) },
    ]
  }

  if (report.type === 'profit') {
    return [
      { label: 'Sales', value: formatMoney(report.summary.sales) },
      { label: 'Expenses', value: formatMoney(report.summary.otherExpenses) },
      { label: 'Commissions', value: formatMoney(report.summary.commissions) },
      { label: 'Profit', value: formatMoney(report.summary.profit), hint: `${percent(report.summary.margin)} of sales`, tone: profitTone(report.summary.profit) },
    ]
  }

  if (report.type === 'rentals') {
    return [
      { label: 'Rentals', value: String(report.summary.count) },
      { label: 'Rental totals', value: formatMoney(report.summary.totalAmount) },
    ]
  }

  if (report.type === 'inventory') {
    return [
      { label: 'Products', value: String(report.summary.count) },
      { label: 'Rentable units', value: String(report.summary.rentableUnits) },
      { label: 'Inventory value', value: formatMoney(report.summary.inventoryValue) },
    ]
  }

  return [
    { label: 'Booked unit-days', value: String(report.summary.bookedUnitDays) },
    { label: 'Capacity unit-days', value: String(report.summary.capacityUnitDays) },
    { label: 'Utilization', value: `${Math.round(report.summary.utilization * 100)}%` },
  ]
})

const charts = computed<ReportCharts | null>(() => (data.value && 'charts' in data.value ? data.value.charts : null))
const trendSeries = computed(() => {
  if (data.value?.type === 'sales') {
    return ['sales'] as const
  }
  if (data.value?.type === 'expenses') {
    return ['expenses', 'commissions'] as const
  }
  return ['sales', 'expenses', 'commissions', 'profit'] as const
})
const bucketLabel = computed(() => ({ day: 'per day', week: 'per week', month: 'per month' })[charts.value?.bucket ?? 'day'])

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

const categoryItems = computed<ReportBarItem[]>(() => (charts.value?.expensesByCategory ?? []).map(point => ({
  label: point.label,
  hint: point.count === 1 ? '1 entry' : `${point.count} entries`,
  segments: [{ value: point.value, class: point.label === 'commission' ? 'bg-amber-400' : 'bg-rose-300' }],
})))
const vendorItems = computed<ReportBarItem[]>(() => (charts.value?.expensesByVendor ?? []).map(point => ({
  label: point.label,
  hint: point.count === 1 ? '1 entry' : `${point.count} entries`,
  segments: [{ value: point.value, class: 'bg-stone-500' }],
})))
const methodItems = computed<ReportBarItem[]>(() => (charts.value?.salesByMethod ?? []).map(point => ({
  label: point.label,
  hint: plural(point.count, 'payment'),
  segments: [{ value: point.value, class: 'bg-lumen-600' }],
})))
const commissionerItems = computed<ReportBarItem[]>(() => (charts.value?.commissionsByCommissioner ?? []).map(point => ({
  label: point.name,
  hint: `${plural(point.count, 'booking')} · ${formatMoney(point.unclaimed)} unclaimed · ${formatMoney(point.collected)} collected`,
  segments: [
    { value: point.collected, class: 'bg-emerald-500' },
    { value: point.unclaimed, class: 'bg-amber-400' },
  ],
})))
const equipmentItems = computed<ReportBarItem[]>(() => (charts.value?.topEquipment ?? []).map(point => ({
  label: point.label,
  hint: plural(point.count, 'booking'),
  segments: [{ value: point.value, class: 'bg-lumen-600' }],
})))
const statusItems = computed<ReportBarItem[]>(() => (charts.value?.rentalsByStatus ?? []).map(point => ({
  label: point.label,
  segments: [{ value: point.value, class: 'bg-stone-400' }],
})))

const mobileRows = computed(() => {
  const report = data.value
  if (!report) {
    return []
  }

  if (report.type === 'overview' || report.type === 'profit') {
    return []
  }

  if (report.type === 'commissions') {
    return report.rows.map(row => ({
      key: row.uuid,
      title: row.commissioner,
      meta: `${row.incurredOn} · ${row.rentalCode || '—'} · ${row.status}`,
      value: formatMoney(row.amount),
    }))
  }

  if (report.type === 'sales') {
    return report.rows.map(row => ({
      key: row.uuid,
      title: row.rentalCode || 'Sale',
      meta: row.paidOn,
      value: formatMoney(row.amount),
    }))
  }

  if (report.type === 'expenses') {
    return report.rows.map(row => ({
      key: row.uuid,
      title: row.name,
      meta: `${row.incurredOn} · ${row.category}`,
      value: formatMoney(row.amount),
    }))
  }

  if (report.type === 'rentals') {
    return report.rows.map(row => ({
      key: row.uuid,
      title: row.code,
      meta: `${row.customerName || '—'} · ${row.startsOn} – ${row.endsOn}`,
      value: formatMoney(row.totalAmount),
    }))
  }

  if (report.type === 'inventory') {
    return report.rows.map(row => ({
      key: row.uuid,
      title: row.name,
      meta: `${row.sku} · ${row.rentable} rentable of ${row.quantity}`,
      value: formatMoney(row.inventoryValue),
    }))
  }

  return report.rows.map(row => ({
    key: row.uuid,
    title: row.name,
    meta: `${row.bookedUnitDays} booked / ${row.capacityUnitDays} capacity`,
    value: `${Math.round(row.utilization * 100)}%`,
  }))
})
</script>

<template>
  <div class="w-full space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
          Finance
        </p>
        <h2 class="mt-2 text-2xl font-medium text-stone-900">
          Reports
        </h2>
        <p class="mt-1 text-sm text-stone-600">
          Sales, expenses, commissions, profit, rentals, inventory, and utilization. Totals use Asia/Manila dates. Profit is sales minus expenses and commissions.
        </p>
      </div>
      <UButton
        :to="csvHref"
        color="neutral"
        variant="outline"
        external
      >
        Download CSV
      </UButton>
    </div>

    <form
      class="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-3"
      method="get"
      @submit.prevent
    >
      <label class="block text-sm">
        <span class="mb-1 block text-xs font-medium text-stone-600">Report</span>
        <select
          v-model="type"
          class="w-full rounded-md border border-stone-200 px-3 py-2 text-sm capitalize"
        >
          <option
            v-for="item in REPORT_TYPES"
            :key="item"
            :value="item"
          >
            {{ item }}
          </option>
        </select>
      </label>
      <label class="block text-sm">
        <span class="mb-1 block text-xs font-medium text-stone-600">Starts</span>
        <input
          v-model="startsOn"
          class="w-full rounded-md border border-stone-200 px-3 py-2 text-sm"
          type="date"
        >
      </label>
      <label class="block text-sm">
        <span class="mb-1 block text-xs font-medium text-stone-600">Ends</span>
        <input
          v-model="endsOn"
          class="w-full rounded-md border border-stone-200 px-3 py-2 text-sm"
          type="date"
        >
      </label>
    </form>

    <AdminNotice
      v-if="remote.unavailable"
      title="Reports are not connected"
      description="Add live Supabase credentials to load report totals."
    />

    <AdminNotice
      v-else-if="remote.failed"
      tone="alert"
      title="Reports could not load"
      description="Try another range or refresh the page. Totals will appear when the request succeeds."
    />

    <template v-else>
      <div
        v-if="remote.loading"
        class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        role="status"
        aria-busy="true"
      >
        <USkeleton
          v-for="index in 4"
          :key="index"
          class="h-24 w-full"
        />
      </div>

      <template v-else>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article
            v-for="card in summaryCards"
            :key="card.label"
            class="min-w-0 rounded-xl border border-stone-200 bg-white p-4"
          >
            <p class="text-xs uppercase tracking-wider text-stone-500">
              {{ card.label }}
            </p>
            <p
              class="mt-3 text-2xl"
              :class="card.tone === 'bad' ? 'text-red-600' : card.tone === 'good' ? 'text-emerald-700' : 'text-stone-900'"
            >
              {{ card.value }}
            </p>
            <p
              v-if="card.hint"
              class="mt-1 text-xs text-stone-500"
            >
              {{ card.hint }}
            </p>
          </article>
        </div>

        <section
          v-if="charts?.trend?.length"
          class="rounded-xl border border-stone-200 bg-white p-5"
        >
          <h3 class="text-sm font-medium text-stone-900">
            <template v-if="data?.type === 'sales'">
              Sales {{ bucketLabel }}
            </template>
            <template v-else-if="data?.type === 'expenses'">
              Expenses and commissions {{ bucketLabel }}
            </template>
            <template v-else>
              Sales, costs, and profit {{ bucketLabel }}
            </template>
          </h3>
          <p class="mt-1 mb-4 text-xs text-stone-500">
            Hover a bar to see the amounts.
          </p>
          <ReportTrendChart
            :points="charts.trend"
            :series="[...trendSeries]"
          />
        </section>

        <div
          v-if="charts && data?.type !== 'profit'"
          class="grid gap-4 lg:grid-cols-2"
        >
          <ReportBarList
            v-if="charts.expensesByCategory"
            title="Expenses by category"
            description="Void entries are not counted."
            :items="categoryItems"
            empty-text="No expenses in this range."
            capitalize
          />
          <ReportBarList
            v-if="charts.expensesByVendor"
            title="Top vendors"
            :items="vendorItems"
            empty-text="No expenses in this range."
          />
          <ReportBarList
            v-if="charts.salesByMethod"
            title="Sales by payment method"
            :items="methodItems"
            empty-text="No paid payments in this range."
          />
          <ReportBarList
            v-if="charts.commissionsByCommissioner"
            title="Commissions by commissioner"
            description="Recorded once a booking is approved. Unpaid extensions are not counted."
            :items="commissionerItems"
            empty-text="No commissions in this range."
          >
            <template #legend>
              <ul class="mt-2 flex gap-4 text-xs text-stone-600">
                <li class="flex items-center gap-1.5">
                  <span class="size-2.5 rounded-sm bg-emerald-500" />
                  Collected
                </li>
                <li class="flex items-center gap-1.5">
                  <span class="size-2.5 rounded-sm bg-amber-400" />
                  Unclaimed
                </li>
              </ul>
            </template>
          </ReportBarList>
          <ReportBarList
            v-if="charts.topEquipment"
            title="Top equipment by booking value"
            description="Confirmed bookings starting in this range."
            :items="equipmentItems"
            empty-text="No confirmed bookings in this range."
          />
          <ReportBarList
            v-if="charts.rentalsByStatus"
            title="Bookings by status"
            description="Bookings starting in this range, drafts excluded."
            :items="statusItems"
            format="count"
            empty-text="No bookings in this range."
            capitalize
          />
        </div>
      </template>

      <ul
        v-if="mobileRows.length"
        class="space-y-3 md:hidden"
      >
        <li
          v-for="row in mobileRows"
          :key="row.key"
          class="rounded-xl border border-stone-200 bg-white p-4"
        >
          <p class="font-medium break-words text-stone-900">
            {{ row.title }}
          </p>
          <p class="mt-1 text-sm break-words text-stone-500">
            {{ row.meta }}
          </p>
          <p class="mt-2 text-sm text-stone-900">
            {{ row.value }}
          </p>
        </li>
      </ul>

      <ReportMonthTable
        v-if="data && (data.type === 'overview' || data.type === 'profit')"
        :months="data.months"
      />

      <div
        v-else
        class="hidden overflow-x-auto rounded-xl border border-stone-200 bg-white md:block"
      >
        <table
          v-if="data?.type === 'commissions'"
          class="min-w-full text-left text-sm"
        >
          <thead class="bg-stone-50 text-stone-500">
            <tr>
              <th class="px-4 py-3 font-medium">
                Recorded
              </th>
              <th class="px-4 py-3 font-medium">
                Commissioner
              </th>
              <th class="px-4 py-3 font-medium">
                Rental
              </th>
              <th class="px-4 py-3 font-medium">
                Details
              </th>
              <th class="px-4 py-3 text-right font-medium">
                Amount
              </th>
              <th class="px-4 py-3 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100">
            <tr
              v-for="row in data.rows"
              :key="row.uuid"
            >
              <td class="px-4 py-3">
                {{ row.incurredOn }}
              </td>
              <td class="px-4 py-3">
                {{ row.commissioner }}
              </td>
              <td class="px-4 py-3">
                <NuxtLink
                  v-if="row.rentalCode"
                  :to="`/admin/rentals/${row.rentalCode}`"
                  class="text-lumen-700 hover:underline"
                >
                  {{ row.rentalCode }}
                </NuxtLink>
                <template v-else>
                  —
                </template>
              </td>
              <td class="px-4 py-3 text-stone-500">
                {{ row.description || '—' }}
              </td>
              <td class="px-4 py-3 text-right tabular-nums">
                {{ formatMoney(row.amount) }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                  :class="row.status === 'collected' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
                >
                  {{ row.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <table
          v-else-if="data?.type === 'sales'"
          class="min-w-full text-left text-sm"
        >
          <thead class="bg-stone-50 text-stone-500">
            <tr>
              <th class="px-4 py-3 font-medium">
                Paid on
              </th>
              <th class="px-4 py-3 font-medium">
                Rental
              </th>
              <th class="px-4 py-3 font-medium">
                Method
              </th>
              <th class="px-4 py-3 font-medium">
                Amount
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100">
            <tr
              v-for="row in data.rows"
              :key="row.uuid"
            >
              <td class="px-4 py-3">
                {{ row.paidOn }}
              </td>
              <td class="px-4 py-3">
                {{ row.rentalCode || '—' }}
              </td>
              <td class="px-4 py-3">
                {{ paymentMethodLabel(row.method) }}
              </td>
              <td class="px-4 py-3">
                {{ formatMoney(row.amount) }}
              </td>
            </tr>
          </tbody>
        </table>

        <table
          v-else-if="data?.type === 'expenses'"
          class="min-w-full text-left text-sm"
        >
          <thead class="bg-stone-50 text-stone-500">
            <tr>
              <th class="px-4 py-3 font-medium">
                Incurred
              </th>
              <th class="px-4 py-3 font-medium">
                Name
              </th>
              <th class="px-4 py-3 font-medium">
                Category
              </th>
              <th class="px-4 py-3 font-medium">
                Amount
              </th>
              <th class="px-4 py-3 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100">
            <tr
              v-for="row in data.rows"
              :key="row.uuid"
            >
              <td class="px-4 py-3">
                {{ row.incurredOn }}
              </td>
              <td class="px-4 py-3">
                {{ row.name }}
              </td>
              <td class="px-4 py-3 capitalize">
                {{ row.category }}
              </td>
              <td class="px-4 py-3">
                {{ formatMoney(row.amount) }}
              </td>
              <td class="px-4 py-3">
                <StatusBadge :status="row.status" />
              </td>
            </tr>
          </tbody>
        </table>

        <table
          v-else-if="data?.type === 'rentals'"
          class="min-w-full text-left text-sm"
        >
          <thead class="bg-stone-50 text-stone-500">
            <tr>
              <th class="px-4 py-3 font-medium">
                Code
              </th>
              <th class="px-4 py-3 font-medium">
                Customer
              </th>
              <th class="px-4 py-3 font-medium">
                Dates
              </th>
              <th class="px-4 py-3 font-medium">
                Total
              </th>
              <th class="px-4 py-3 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100">
            <tr
              v-for="row in data.rows"
              :key="row.uuid"
            >
              <td class="px-4 py-3">
                {{ row.code }}
              </td>
              <td class="px-4 py-3">
                {{ row.customerName || '—' }}
              </td>
              <td class="px-4 py-3">
                {{ row.startsOn }} – {{ row.endsOn }}
              </td>
              <td class="px-4 py-3">
                {{ formatMoney(row.totalAmount) }}
              </td>
              <td class="px-4 py-3">
                <StatusBadge :status="row.status" />
              </td>
            </tr>
          </tbody>
        </table>

        <table
          v-else-if="data?.type === 'inventory'"
          class="min-w-full text-left text-sm"
        >
          <thead class="bg-stone-50 text-stone-500">
            <tr>
              <th class="px-4 py-3 font-medium">
                Product
              </th>
              <th class="px-4 py-3 font-medium">
                SKU
              </th>
              <th class="px-4 py-3 font-medium">
                Qty
              </th>
              <th class="px-4 py-3 font-medium">
                Rentable
              </th>
              <th class="px-4 py-3 font-medium">
                Value
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100">
            <tr
              v-for="row in data.rows"
              :key="row.uuid"
            >
              <td class="px-4 py-3">
                {{ row.name }}
              </td>
              <td class="px-4 py-3">
                {{ row.sku }}
              </td>
              <td class="px-4 py-3">
                {{ row.quantity }}
              </td>
              <td class="px-4 py-3">
                {{ row.rentable }}
              </td>
              <td class="px-4 py-3">
                {{ formatMoney(row.inventoryValue) }}
              </td>
            </tr>
          </tbody>
        </table>

        <table
          v-else-if="data?.type === 'utilization'"
          class="min-w-full text-left text-sm"
        >
          <thead class="bg-stone-50 text-stone-500">
            <tr>
              <th class="px-4 py-3 font-medium">
                Product
              </th>
              <th class="px-4 py-3 font-medium">
                Booked
              </th>
              <th class="px-4 py-3 font-medium">
                Capacity
              </th>
              <th class="px-4 py-3 font-medium">
                Utilization
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100">
            <tr
              v-for="row in data.rows"
              :key="row.uuid"
            >
              <td class="px-4 py-3">
                {{ row.name }}
              </td>
              <td class="px-4 py-3">
                {{ row.bookedUnitDays }}
              </td>
              <td class="px-4 py-3">
                {{ row.capacityUnitDays }}
              </td>
              <td class="px-4 py-3">
                {{ Math.round(row.utilization * 100) }}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p
        v-if="data && !data.rows.length"
        class="rounded-xl border border-stone-200 bg-white px-4 py-6 text-sm text-stone-500"
      >
        No rows in this range.
      </p>
    </template>
  </div>
</template>
