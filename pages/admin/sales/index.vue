<script setup lang="ts">
import type { AdminReport, ReportBarItem } from '~/types/report'
import { calendarDateInZone } from '~/utils/datetime'
import { monthStart } from '~/utils/analytics'
import { paymentMethodLabel } from '~/utils/report'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Sales',
  path: '/admin/sales',
})

const startsOn = ref(monthStart(calendarDateInZone()))
const endsOn = ref(calendarDateInZone())
const { formatMoney } = useCurrency()

const query = computed(() => ({
  startsOn: startsOn.value,
  endsOn: endsOn.value,
}))

const { data, error, pending } = await useFetch<Extract<AdminReport, { type: 'sales' }>>('/api/admin/sales', {
  query,
  watch: [query],
})

const unavailable = computed(() => error.value?.statusCode === 503)
const rows = computed(() => data.value?.rows ?? [])
const trend = computed(() => data.value?.charts?.trend ?? [])
const bucketLabel = computed(() => ({ day: 'per day', week: 'per week', month: 'per month' })[data.value?.charts?.bucket ?? 'day'])
const methodItems = computed<ReportBarItem[]>(() => (data.value?.charts?.salesByMethod ?? []).map(point => ({
  label: point.label,
  hint: `${point.count} payment${point.count === 1 ? '' : 's'}`,
  segments: [{ value: point.value, class: 'bg-lumen-600' }],
})))
const csvHref = computed(() => {
  const params = new URLSearchParams({
    startsOn: startsOn.value,
    endsOn: endsOn.value,
    format: 'csv',
  })
  return `/api/admin/sales?${params.toString()}`
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
          Sales
        </h2>
        <p class="mt-1 text-sm text-stone-600">
          Paid payments in Asia/Manila. Amounts stay on the server quote that was collected.
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
      class="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-2"
      method="get"
      @submit.prevent
    >
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
      v-if="unavailable"
      title="Sales are not connected"
      description="Add live Supabase credentials to load paid payments."
    />

    <div
      v-else-if="pending && !data"
      class="grid gap-3 sm:grid-cols-2"
    >
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-24 w-full" />
    </div>

    <template v-else>
      <AdminBento>
        <AdminStat
          wide
          tone="dark"
          icon="i-lucide-trending-up"
          label="Actual sales"
          :value="formatMoney(data?.summary.total ?? 0)"
          hint="Payments minus deposits held and commissions"
        />
        <AdminStat
          icon="i-lucide-badge-check"
          label="Paid payments"
          :value="String(data?.summary.count ?? 0)"
        />
        <AdminStat
          icon="i-lucide-calculator"
          label="Average sale"
          :value="formatMoney(data?.summary.average ?? 0)"
        />

        <AdminTile
          v-if="rows.length"
          size="wide"
          :title="`Actual sales ${bucketLabel}`"
          icon="i-lucide-chart-column"
          description="Hover a bar to see the amount."
        >
          <ReportTrendChart
            :points="trend"
            :series="['sales']"
          />
        </AdminTile>
        <div
          v-if="rows.length"
          class="col-span-2 min-w-0 [&>*]:h-full"
        >
          <ReportBarList
            title="Sales by payment method"
            :items="methodItems"
            empty-text="No paid payments in this range."
          />
        </div>
      </AdminBento>

      <AdminNotice
        v-if="!rows.length"
        title="No sales in this range"
        description="Paid payments in this date range will appear here."
      />

      <ul
        v-else
        class="space-y-3 md:hidden"
      >
        <li
          v-for="row in rows"
          :key="row.uuid"
          class="rounded-xl border border-stone-200 bg-white p-4"
        >
          <p class="font-medium break-words text-stone-900">
            {{ row.rentalCode || 'Sale' }}
          </p>
          <p class="mt-1 text-sm break-words text-stone-500">
            {{ row.paidOn }}
            · {{ paymentMethodLabel(row.method) }}
          </p>
          <p class="mt-2 text-sm text-stone-900">
            {{ formatMoney(row.amount) }}
          </p>
          <UButton
            v-if="row.rentalCode"
            :to="`/admin/rentals/${row.rentalCode}`"
            color="neutral"
            variant="ghost"
            size="sm"
            class="mt-2 -ml-2"
          >
            Open rental
          </UButton>
        </li>
      </ul>

      <div
        v-if="rows.length"
        class="hidden overflow-x-auto rounded-xl border border-stone-200 bg-white md:block"
      >
        <table class="min-w-full text-left text-sm">
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
                Sale
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100">
            <tr
              v-for="row in rows"
              :key="row.uuid"
            >
              <td class="px-4 py-3">
                {{ row.paidOn }}
              </td>
              <td class="px-4 py-3">
                <NuxtLink
                  v-if="row.rentalCode"
                  :to="`/admin/rentals/${row.rentalCode}`"
                  class="text-lumen-800 hover:underline"
                >
                  {{ row.rentalCode }}
                </NuxtLink>
                <span v-else>—</span>
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
      </div>
    </template>
  </div>
</template>
