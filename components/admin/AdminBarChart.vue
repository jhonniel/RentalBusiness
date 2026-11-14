<script setup lang="ts">
interface BarPoint {
  key: string
  label: string
  value: number
  hint?: string
}

const props = withDefaults(defineProps<{
  points: BarPoint[]
  totalLabel?: string
  format?: (value: number) => string
  formatAxis?: (value: number) => string
}>(), {
  totalLabel: 'Total',
  format: (value: number) => String(value),
  formatAxis: undefined,
})

const active = ref<string | null>(null)

function niceMax(raw: number) {
  if (raw <= 0) {
    return 1
  }
  const power = 10 ** Math.floor(Math.log10(raw))
  const scaled = raw / power
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return nice * power
}

const axis = (value: number) => (props.formatAxis ?? props.format)(value)
const max = computed(() => niceMax(Math.max(0, ...props.points.map(point => point.value))))
const total = computed(() => props.points.reduce((sum, point) => sum + point.value, 0))
const focused = computed(() => props.points.find(point => point.key === active.value) ?? null)
const summary = computed(() => props.points.map(point => `${point.label}: ${props.format(point.value)}`).join(', '))

function height(value: number) {
  return `${Math.max(0, Math.min(100, (value / max.value) * 100))}%`
}

function hover(event: PointerEvent, key: string | null) {
  if (event.pointerType === 'mouse') {
    active.value = key
  }
}
</script>

<template>
  <div>
    <div class="flex min-h-11 items-baseline justify-between gap-3">
      <p class="min-w-0 truncate text-sm text-stone-500">
        <template v-if="focused">
          <span class="font-medium text-stone-900">{{ focused.label }}</span>
          <span v-if="focused.hint"> · {{ focused.hint }}</span>
        </template>
        <template v-else>
          {{ totalLabel }}
        </template>
      </p>
      <p class="shrink-0 text-lg font-semibold tabular-nums text-stone-900">
        {{ format(focused ? focused.value : total) }}
      </p>
    </div>

    <div class="mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
      <div class="flex h-44 flex-col justify-between text-right text-[11px] tabular-nums text-stone-400 sm:h-52">
        <span>{{ axis(max) }}</span>
        <span>{{ axis(max / 2) }}</span>
        <span>{{ axis(0) }}</span>
      </div>

      <div
        class="relative h-44 sm:h-52"
        role="img"
        :aria-label="summary"
      >
        <div class="pointer-events-none absolute inset-0 flex flex-col justify-between">
          <span class="border-t border-stone-100" />
          <span class="border-t border-stone-100" />
          <span class="border-t border-stone-300" />
        </div>
        <div class="relative flex h-full items-end gap-2 sm:gap-3">
          <button
            v-for="(point, index) in points"
            :key="point.key"
            type="button"
            data-compact
            class="relative flex h-full min-w-0 flex-1 items-end justify-center"
            :aria-label="`${point.label}: ${format(point.value)}${point.hint ? `, ${point.hint}` : ''}`"
            :title="`${point.label} · ${format(point.value)}`"
            @pointerenter="hover($event, point.key)"
            @pointerleave="hover($event, null)"
            @focus="active = point.key"
            @blur="active = null"
            @click="active = point.key"
          >
            <span
              class="pointer-events-none absolute inset-x-0 truncate text-center text-[10px] tabular-nums sm:text-[11px]"
              :class="active === point.key ? 'font-semibold text-stone-900' : 'text-stone-500'"
              :style="{ bottom: `calc(${height(point.value)} + 4px)` }"
            >{{ axis(point.value) }}</span>
            <span
              class="chart-grow-y block w-full max-w-14 rounded-t-lg transition-colors"
              :class="[
                point.value > 0 ? 'min-h-1' : '',
                active === point.key ? 'bg-lumen-500' : active === null ? 'bg-lumen-700' : 'bg-lumen-700/40',
              ]"
              :style="{ height: height(point.value), animationDelay: `${index * 60}ms` }"
            />
          </button>
        </div>
      </div>

      <span />
      <div class="mt-2 flex gap-2 sm:gap-3">
        <span
          v-for="point in points"
          :key="point.key"
          class="line-clamp-2 min-w-0 flex-1 break-words text-center text-[11px] leading-tight"
          :class="active === point.key ? 'font-semibold text-stone-900' : 'text-stone-500'"
        >{{ point.label }}</span>
      </div>
    </div>
  </div>
</template>
