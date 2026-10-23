<script setup lang="ts">
import type { ReportTrendPoint } from '~/types/report'

type Series = 'sales' | 'expenses' | 'commissions' | 'profit'

const props = withDefaults(defineProps<{
  points: ReportTrendPoint[]
  series?: Series[]
}>(), {
  series: () => ['sales', 'expenses', 'commissions', 'profit'],
})

const { formatMoney } = useCurrency()
const compact = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const width = 720
const height = 240
const pad = { top: 12, right: 12, bottom: 30, left: 60 }
const plotWidth = width - pad.left - pad.right
const plotHeight = height - pad.top - pad.bottom

const showSales = computed(() => props.series.includes('sales'))
const showExpenses = computed(() => props.series.includes('expenses'))
const showCommissions = computed(() => props.series.includes('commissions'))
const showProfit = computed(() => props.series.includes('profit'))
const showCost = computed(() => showExpenses.value || showCommissions.value)

function cost(point: ReportTrendPoint) {
  return (showExpenses.value ? point.expenses : 0) + (showCommissions.value ? point.commissions : 0)
}

function niceStep(raw: number) {
  if (raw <= 0) {
    return 1
  }
  const power = 10 ** Math.floor(Math.log10(raw))
  const scaled = raw / power
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return nice * power
}

const scale = computed(() => {
  const values = props.points.flatMap(point => [
    showSales.value ? point.sales : 0,
    cost(point),
    showProfit.value ? point.profit : 0,
  ])
  const rawMax = Math.max(0, ...values)
  const rawMin = Math.min(0, ...values)
  const step = niceStep((rawMax - rawMin || 1) / 4)
  const max = Math.max(step, Math.ceil(rawMax / step) * step)
  const min = Math.floor(rawMin / step) * step
  const ticks: number[] = []
  for (let value = min; value <= max + step / 2; value += step) {
    ticks.push(value)
  }
  return { max, min, ticks }
})

function y(value: number) {
  const { max, min } = scale.value
  return pad.top + ((max - value) / (max - min || 1)) * plotHeight
}

const groupWidth = computed(() => plotWidth / Math.max(1, props.points.length))
const barCount = computed(() => (showSales.value ? 1 : 0) + (showCost.value ? 1 : 0))
const barWidth = computed(() => Math.max(2, Math.min(26, (groupWidth.value * 0.72) / Math.max(1, barCount.value))))
const labelEvery = computed(() => Math.max(1, Math.ceil(props.points.length / 10)))

function groupX(index: number) {
  return pad.left + index * groupWidth.value
}

function barX(index: number, slot: number) {
  const used = barWidth.value * barCount.value
  return groupX(index) + (groupWidth.value - used) / 2 + slot * barWidth.value
}

function rect(value: number, base = 0) {
  const top = y(base + value)
  const bottom = y(base)
  return { y: Math.min(top, bottom), height: Math.max(0, Math.abs(bottom - top)) }
}

const profitPath = computed(() => props.points
  .map((point, index) => `${index === 0 ? 'M' : 'L'}${groupX(index) + groupWidth.value / 2},${y(point.profit)}`)
  .join(' '))

const animationKey = computed(() => `${props.series.join('-')}:${props.points.map(point => `${point.startsOn}=${point.sales}/${point.expenses}/${point.commissions}`).join(',')}`)

function barDelay(index: number) {
  return { animationDelay: `${Math.min(600, index * (600 / Math.max(1, props.points.length)))}ms` }
}

function pointTitle(point: ReportTrendPoint) {
  return [
    point.label,
    showSales.value ? `Sales ${formatMoney(point.sales)}` : '',
    showExpenses.value ? `Expenses ${formatMoney(point.expenses)}` : '',
    showCommissions.value ? `Commissions ${formatMoney(point.commissions)}` : '',
    showProfit.value ? `Profit ${formatMoney(point.profit)}` : '',
  ].filter(Boolean).join('\n')
}
</script>

<template>
  <div>
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
      <li
        v-if="showSales"
        class="flex items-center gap-1.5"
      >
        <span class="size-2.5 rounded-sm bg-lumen-600" />
        Sales
      </li>
      <li
        v-if="showExpenses"
        class="flex items-center gap-1.5"
      >
        <span class="size-2.5 rounded-sm bg-rose-300" />
        Expenses
      </li>
      <li
        v-if="showCommissions"
        class="flex items-center gap-1.5"
      >
        <span class="size-2.5 rounded-sm bg-amber-400" />
        Commissions
      </li>
      <li
        v-if="showProfit"
        class="flex items-center gap-1.5"
      >
        <span class="h-0.5 w-3 rounded-full bg-emerald-600" />
        Profit
      </li>
    </ul>
    <div class="mt-3 overflow-x-auto">
      <svg
        :key="animationKey"
        :viewBox="`0 0 ${width} ${height}`"
        class="h-auto w-full min-w-[34rem]"
        role="img"
        aria-label="Trend chart"
      >
        <g>
          <template
            v-for="tick in scale.ticks"
            :key="tick"
          >
            <line
              :x1="pad.left"
              :x2="width - pad.right"
              :y1="y(tick)"
              :y2="y(tick)"
              :class="tick === 0 ? 'stroke-stone-300' : 'stroke-stone-100'"
              stroke-width="1"
            />
            <text
              :x="pad.left - 8"
              :y="y(tick) + 4"
              text-anchor="end"
              class="fill-stone-400 text-[11px]"
            >{{ compact.format(tick) }}</text>
          </template>
        </g>

        <g
          v-for="(point, index) in points"
          :key="point.startsOn"
        >
          <title>{{ pointTitle(point) }}</title>
          <rect
            :x="groupX(index)"
            :y="pad.top"
            :width="groupWidth"
            :height="plotHeight"
            class="fill-transparent hover:fill-stone-50"
          />
          <rect
            v-if="showSales"
            :x="barX(index, 0)"
            :width="barWidth - 1"
            v-bind="rect(point.sales)"
            rx="2"
            class="chart-grow-y fill-lumen-600"
            :style="barDelay(index)"
          />
          <g
            v-if="showCost"
            class="chart-grow-y"
            :style="barDelay(index)"
          >
            <rect
              v-if="showExpenses"
              :x="barX(index, showSales ? 1 : 0)"
              :width="barWidth - 1"
              v-bind="rect(point.expenses)"
              rx="2"
              class="fill-rose-300"
            />
            <rect
              v-if="showCommissions"
              :x="barX(index, showSales ? 1 : 0)"
              :width="barWidth - 1"
              v-bind="rect(point.commissions, showExpenses ? point.expenses : 0)"
              rx="2"
              class="fill-amber-400"
            />
          </g>
          <text
            v-if="index % labelEvery === 0"
            :x="groupX(index) + groupWidth / 2"
            :y="height - 10"
            text-anchor="middle"
            class="fill-stone-500 text-[11px]"
          >{{ point.label }}</text>
        </g>

        <g v-if="showProfit && points.length">
          <path
            :d="profitPath"
            fill="none"
            pathLength="1"
            class="chart-draw stroke-emerald-600"
            stroke-width="2"
            stroke-linejoin="round"
          />
          <circle
            v-for="(point, index) in points"
            :key="`profit-${point.startsOn}`"
            :cx="groupX(index) + groupWidth / 2"
            :cy="y(point.profit)"
            r="2.5"
            class="chart-fade pointer-events-none fill-emerald-600"
            :style="{ animationDelay: `${250 + (index / Math.max(1, points.length)) * 1100}ms` }"
          />
        </g>
      </svg>
    </div>
  </div>
</template>
