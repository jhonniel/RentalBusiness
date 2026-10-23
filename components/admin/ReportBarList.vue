<script setup lang="ts">
import type { ReportBarItem } from '~/types/report'

const props = withDefaults(defineProps<{
  title: string
  description?: string
  items: ReportBarItem[]
  format?: 'money' | 'count'
  emptyText?: string
  capitalize?: boolean
}>(), {
  description: '',
  format: 'money',
  emptyText: 'Nothing in this range.',
  capitalize: false,
})

const { formatMoney } = useCurrency()

function total(item: ReportBarItem) {
  return item.segments.reduce((sum, segment) => sum + segment.value, 0)
}

const max = computed(() => Math.max(1, ...props.items.map(total)))

function display(value: number) {
  return props.format === 'money' ? formatMoney(value) : String(value)
}
</script>

<template>
  <section class="rounded-xl border border-stone-200 bg-white p-5">
    <h3 class="text-sm font-medium text-stone-900">
      {{ title }}
    </h3>
    <p
      v-if="description"
      class="mt-1 text-xs text-stone-500"
    >
      {{ description }}
    </p>
    <slot name="legend" />
    <ul
      v-if="items.length"
      class="mt-4 space-y-3"
    >
      <li
        v-for="(item, itemIndex) in items"
        :key="item.label"
        class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm"
      >
        <span class="min-w-0">
          <span
            class="block truncate text-stone-800"
            :class="capitalize ? 'capitalize' : ''"
          >{{ item.label.replaceAll('_', ' ') }}</span>
          <span
            v-if="item.hint"
            class="block text-xs text-stone-500"
          >{{ item.hint }}</span>
        </span>
        <span class="text-right text-stone-900 tabular-nums">{{ display(total(item)) }}</span>
        <span class="col-span-2 flex h-2 overflow-hidden rounded-full bg-stone-100">
          <span
            class="chart-grow-x flex h-full w-full"
            :style="{ animationDelay: `${itemIndex * 60}ms` }"
          >
            <span
              v-for="(segment, index) in item.segments"
              :key="index"
              class="chart-width block h-full"
              :class="segment.class"
              :style="{ width: `${(segment.value / max) * 100}%` }"
            />
          </span>
        </span>
      </li>
    </ul>
    <p
      v-else
      class="mt-4 text-sm text-stone-500"
    >
      {{ emptyText }}
    </p>
  </section>
</template>
