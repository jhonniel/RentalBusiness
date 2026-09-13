<script setup lang="ts">
import type { AdminReport, ReportType } from '~/types/report'
import { REPORT_TYPES } from '~/types/report'
import { calendarDateInZone } from '~/utils/datetime'
import { monthStart } from '~/utils/analytics'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Reports',
  path: '/admin/reports',
})

const type = ref<ReportType>('sales')
const startsOn = ref(monthStart(calendarDateInZone()))
const endsOn = ref(calendarDateInZone())
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

const summaryCards = computed(() => {
  const report = data.value
  if (!report) {
    return []
  }

  if (report.type === 'sales' || report.type === 'expenses') {
    return [
      { label: 'Rows', value: String(report.summary.count) },
      { label: 'Total', value: formatMoney(report.summary.total) },
    ]
  }

  if (report.type === 'profit') {
    return [
      { label: 'Sales', value: formatMoney(report.summary.sales) },
      { label: 'Expenses', value: formatMoney(report.summary.expenses) },
      { label: 'Profit', value: formatMoney(report.summary.profit) },
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
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
          Finance
        </p>
        <h2 class="mt-2 text-2xl font-medium text-stone-900">
          Reports
        </h2>
        <p class="mt-1 text-sm text-stone-600">
          Sales, expenses, profit, rentals, inventory, and utilization. Totals use Asia/Manila dates.
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
        class="grid gap-3 sm:grid-cols-3"
        role="status"
        aria-busy="true"
      >
        <USkeleton
          v-for="index in 3"
          :key="index"
          class="h-24 w-full"
        />
      </div>

      <div
        v-else
        class="grid gap-3 sm:grid-cols-3"
      >
        <article
          v-for="card in summaryCards"
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

      <div class="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table
          v-if="data?.type === 'sales'"
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
          v-else-if="data?.type === 'profit'"
          class="min-w-full text-left text-sm"
        >
          <thead class="bg-stone-50 text-stone-500">
            <tr>
              <th class="px-4 py-3 font-medium">
                Date
              </th>
              <th class="px-4 py-3 font-medium">
                Sales
              </th>
              <th class="px-4 py-3 font-medium">
                Expenses
              </th>
              <th class="px-4 py-3 font-medium">
                Profit
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100">
            <tr
              v-for="row in data.rows"
              :key="row.date"
            >
              <td class="px-4 py-3">
                {{ row.date }}
              </td>
              <td class="px-4 py-3">
                {{ formatMoney(row.sales) }}
              </td>
              <td class="px-4 py-3">
                {{ formatMoney(row.expenses) }}
              </td>
              <td class="px-4 py-3">
                {{ formatMoney(row.profit) }}
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

        <p
          v-if="data && !data.rows.length"
          class="px-4 py-6 text-sm text-stone-500"
        >
          No rows in this range.
        </p>
      </div>
    </template>
  </div>
</template>
