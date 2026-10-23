<script setup lang="ts">
import type { AdminReport, ReportBarItem } from '~/types/report'
import type { ReportPeriod } from '~/utils/report'
import { REPORT_PERIOD_LABELS, REPORT_PERIODS } from '~/utils/report'

const props = defineProps<{
  report: Extract<AdminReport, { type: 'expenses' }> | null
  loading: boolean
}>()

const period = defineModel<ReportPeriod>('period', { required: true })
const { formatMoney } = useCurrency()

const summary = computed(() => props.report?.summary ?? null)
const charts = computed(() => props.report?.charts ?? null)
const bucketLabel = computed(() => ({ day: 'per day', week: 'per week', month: 'per month' })[charts.value?.bucket ?? 'day'])

const cards = computed(() => {
  if (!summary.value) {
    return []
  }
  const value = summary.value
  return [
    { label: 'Total expenses', value: formatMoney(value.total), hint: `${value.count - value.voidCount} entr${value.count - value.voidCount === 1 ? 'y' : 'ies'}${value.voidCount ? ` · ${value.voidCount} void` : ''}` },
    { label: 'Paid', value: formatMoney(value.paid), tone: 'text-emerald-700' },
    { label: 'Unpaid', value: formatMoney(value.pending), hint: 'Pending entries still to settle', tone: value.pending > 0 ? 'text-amber-700' : '' },
    { label: 'Commissions', value: formatMoney(value.commissions), hint: 'Unclaimed and collected' },
    { label: 'Other expenses', value: formatMoney(value.otherExpenses), hint: 'Everything except commissions' },
  ]
})

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

const statusItems = computed<ReportBarItem[]>(() => summary.value
  ? [
      { label: 'Paid', segments: [{ value: summary.value.paid, class: 'bg-emerald-500' }] },
      { label: 'Unpaid', segments: [{ value: summary.value.pending, class: 'bg-amber-400' }] },
    ].filter(item => item.segments[0]!.value > 0)
  : [])
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="text-sm font-medium text-stone-900">
        Overview
      </h3>
      <div
        class="flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-white p-1"
        role="group"
        aria-label="Period"
      >
        <button
          v-for="item in REPORT_PERIODS"
          :key="item"
          type="button"
          class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
          :class="period === item ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'"
          :aria-pressed="period === item"
          @click="period = item"
        >
          {{ REPORT_PERIOD_LABELS[item] }}
        </button>
      </div>
    </div>

    <div
      v-if="loading && !report"
      class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      role="status"
      aria-busy="true"
    >
      <USkeleton
        v-for="index in 5"
        :key="index"
        class="h-24 w-full"
      />
    </div>

    <template v-else-if="report">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <article
          v-for="(card, index) in cards"
          :key="card.label"
          class="chart-fade min-w-0 rounded-xl border border-stone-200 bg-white p-4"
          :style="{ animationDelay: `${index * 60}ms` }"
        >
          <p class="text-xs uppercase tracking-wider text-stone-500">
            {{ card.label }}
          </p>
          <p
            class="mt-3 text-2xl"
            :class="card.tone || 'text-stone-900'"
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

      <div class="grid gap-4 lg:grid-cols-3">
        <section class="min-w-0 rounded-xl border border-stone-200 bg-white p-5 lg:col-span-2">
          <h3 class="text-sm font-medium text-stone-900">
            Expenses and commissions {{ bucketLabel }}
          </h3>
          <p class="mt-1 mb-4 text-xs text-stone-500">
            Hover a bar to see the amounts. Void entries are not counted.
          </p>
          <ReportTrendChart
            v-if="charts?.trend?.length"
            :points="charts.trend"
            :series="['expenses', 'commissions']"
          />
        </section>
        <ReportBarList
          title="Paid vs unpaid"
          :items="statusItems"
          empty-text="No expenses in this period."
        />
        <ReportBarList
          title="By category"
          :items="categoryItems"
          empty-text="No expenses in this period."
          capitalize
        />
        <ReportBarList
          title="Top vendors"
          description="Commissioners appear here as the vendor of their commission."
          :items="vendorItems"
          empty-text="No expenses in this period."
          class="lg:col-span-2"
        />
      </div>
    </template>
  </section>
</template>
