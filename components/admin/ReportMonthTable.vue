<script setup lang="ts">
import type { ReportMonthGroup } from '~/types/report'
import { calendarDateInZone, formatBookingDate } from '~/utils/datetime'
import { groupMonthsByYear } from '~/utils/report'

const props = defineProps<{
  months: ReportMonthGroup[]
}>()

const { formatMoney } = useCurrency()
const today = calendarDateInZone()
const years = computed(() => groupMonthsByYear(props.months))
const openMonths = ref(new Set<string>())
const closedYears = ref(new Set<string>())

watch(() => props.months.map(group => group.month).join(','), () => {
  openMonths.value = new Set()
  closedYears.value = new Set()
})

function toggled(set: Set<string>, key: string) {
  const next = new Set(set)
  if (next.has(key)) {
    next.delete(key)
  }
  else {
    next.add(key)
  }
  return next
}

function toggle(month: string) {
  openMonths.value = toggled(openMonths.value, month)
}

function toggleYear(year: string) {
  closedYears.value = toggled(closedYears.value, year)
}

function badgeClass(profit: number) {
  return profit > 0 ? 'bg-emerald-50 text-emerald-700' : profit < 0 ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-600'
}

function weekday(date: string) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${date}T00:00:00Z`).getUTCDay()]
}

function resultLabel(profit: number) {
  return profit > 0 ? 'Profit' : profit < 0 ? 'Loss' : 'Break-even'
}

function profitClass(profit: number) {
  return profit > 0 ? 'text-emerald-700' : profit < 0 ? 'text-red-600' : 'text-stone-500'
}
</script>

<template>
  <div class="space-y-4">
    <section
      v-for="yearGroup in years"
      :key="yearGroup.year"
      class="rounded-xl border border-stone-200 bg-stone-50/60 p-3"
    >
      <button
        type="button"
        class="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-2 py-2 text-left hover:bg-stone-100"
        :aria-expanded="!closedYears.has(yearGroup.year)"
        @click="toggleYear(yearGroup.year)"
      >
        <UIcon
          name="i-lucide-chevron-right"
          class="size-4 shrink-0 text-stone-500 transition-transform"
          :class="closedYears.has(yearGroup.year) ? '' : 'rotate-90'"
        />
        <span class="min-w-24 flex-1 text-lg font-medium text-stone-900">{{ yearGroup.year }}</span>
        <span class="text-xs text-stone-500">Actual sales <span class="text-sm text-stone-900 tabular-nums">{{ formatMoney(yearGroup.totals.sales) }}</span></span>
        <span class="text-xs text-stone-500">Expenses <span class="text-sm text-stone-900 tabular-nums">{{ formatMoney(yearGroup.totals.expenses) }}</span></span>
        <span
          class="rounded-full px-2.5 py-0.5 text-sm font-medium tabular-nums"
          :class="badgeClass(yearGroup.totals.profit)"
        >
          {{ resultLabel(yearGroup.totals.profit) }} {{ formatMoney(yearGroup.totals.profit) }}
        </span>
      </button>

      <div
        v-if="!closedYears.has(yearGroup.year)"
        class="mt-2 space-y-2"
      >
        <section
          v-for="group in yearGroup.months"
          :key="group.month"
          class="overflow-hidden rounded-xl border border-stone-200 bg-white"
        >
          <button
            type="button"
            class="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-stone-50"
            :aria-expanded="openMonths.has(group.month)"
            @click="toggle(group.month)"
          >
            <UIcon
              name="i-lucide-chevron-right"
              class="size-4 shrink-0 text-stone-500 transition-transform"
              :class="openMonths.has(group.month) ? 'rotate-90' : ''"
            />
            <span class="min-w-32 flex-1 font-medium text-stone-900">{{ group.label }}</span>
            <span class="text-xs text-stone-500">Actual sales <span class="text-sm text-stone-900 tabular-nums">{{ formatMoney(group.totals.sales) }}</span></span>
            <span class="text-xs text-stone-500">Expenses <span class="text-sm text-stone-900 tabular-nums">{{ formatMoney(group.totals.expenses) }}</span></span>
            <span
              class="rounded-full px-2.5 py-0.5 text-sm font-medium tabular-nums"
              :class="badgeClass(group.totals.profit)"
            >
              {{ resultLabel(group.totals.profit) }} {{ formatMoney(group.totals.profit) }}
            </span>
          </button>

          <div
            v-if="openMonths.has(group.month)"
            class="overflow-x-auto border-t border-stone-100"
          >
            <table class="min-w-full text-left text-sm">
              <thead class="bg-stone-50 text-stone-500">
                <tr>
                  <th class="px-4 py-2.5 font-medium">
                    Date
                  </th>
                  <th class="px-4 py-2.5 text-right font-medium">
                    Actual sales
                  </th>
                  <th class="px-4 py-2.5 text-right font-medium">
                    Expenses
                  </th>
                  <th class="px-4 py-2.5 text-right font-medium">
                    Profit
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stone-100">
                <tr
                  v-for="day in group.days"
                  :key="day.startsOn"
                  :class="day.startsOn > today ? 'text-stone-400' : day.startsOn === today ? 'bg-lumen-50/60' : ''"
                >
                  <td class="px-4 py-2 whitespace-nowrap">
                    <span class="inline-block w-9 text-xs text-stone-400">{{ weekday(day.startsOn) }}</span>
                    {{ formatBookingDate(day.startsOn) }}
                  </td>
                  <td class="px-4 py-2 text-right tabular-nums">
                    {{ day.sales ? formatMoney(day.sales) : '—' }}
                  </td>
                  <td class="px-4 py-2 text-right tabular-nums">
                    {{ day.expenses ? formatMoney(day.expenses) : '—' }}
                  </td>
                  <td
                    class="px-4 py-2 text-right tabular-nums"
                    :class="day.profit ? profitClass(day.profit) : ''"
                  >
                    {{ day.profit ? formatMoney(day.profit) : '—' }}
                  </td>
                </tr>
              </tbody>
              <tfoot class="border-t-2 border-stone-200 bg-stone-50 font-medium text-stone-900">
                <tr>
                  <td class="px-4 py-3">
                    Total for {{ group.label }}
                  </td>
                  <td class="px-4 py-3 text-right tabular-nums">
                    {{ formatMoney(group.totals.sales) }}
                  </td>
                  <td class="px-4 py-3 text-right tabular-nums">
                    {{ formatMoney(group.totals.expenses) }}
                  </td>
                  <td
                    class="px-4 py-3 text-right tabular-nums"
                    :class="profitClass(group.totals.profit)"
                  >
                    {{ formatMoney(group.totals.profit) }}
                  </td>
                </tr>
                <tr>
                  <td
                    colspan="4"
                    class="px-4 pb-3 text-xs font-normal text-stone-600"
                  >
                    <span :class="profitClass(group.totals.profit)">{{ resultLabel(group.totals.profit) }} this month</span>
                    <template v-if="group.totals.sales > 0">
                      · {{ Math.round(group.totals.margin * 1000) / 10 }}% of sales
                    </template>
                    · Profit is actual sales (after commissions) minus expenses.
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>
