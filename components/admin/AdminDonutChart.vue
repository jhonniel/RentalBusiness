<script setup lang="ts">
interface DonutPoint {
  label: string
  value: number
}

const props = withDefaults(defineProps<{
  points: DonutPoint[]
  totalLabel?: string
  colors?: Record<string, string>
}>(), {
  totalLabel: 'Total',
  colors: () => ({}),
})

const PALETTE = ['#1e3a8a', '#0f766e', '#d97706', '#7c3aed', '#db2777', '#0284c7', '#65a30d', '#dc2626', '#57534e']
const RADIUS = 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const active = ref<string | null>(null)

const total = computed(() => props.points.reduce((sum, point) => sum + Math.max(0, point.value), 0))

const segments = computed(() => {
  const visible = props.points.filter(point => point.value > 0)
  const gap = visible.length > 1 ? 1.5 : 0
  let offset = 0
  return visible.map((point, index) => {
    const share = total.value ? point.value / total.value : 0
    const length = share * CIRCUMFERENCE
    const segment = {
      ...point,
      name: point.label.replaceAll('_', ' '),
      color: props.colors[point.label] ?? PALETTE[index % PALETTE.length]!,
      percent: Math.round(share * 100),
      dash: `${Math.max(0, length - gap)} ${CIRCUMFERENCE}`,
      offset: -offset,
      delay: `${index * 80}ms`,
    }
    offset += length
    return segment
  })
})

const focused = computed(() => segments.value.find(segment => segment.label === active.value) ?? null)

const summary = computed(() => segments.value.map(segment => `${segment.name}: ${segment.value}`).join(', '))

function hover(event: PointerEvent, label: string | null) {
  if (event.pointerType === 'mouse') {
    active.value = label
  }
}

function select(label: string) {
  active.value = active.value === label ? null : label
}
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <div class="relative size-36 shrink-0 sm:size-40">
      <svg
        viewBox="0 0 100 100"
        class="size-full -rotate-90"
        role="img"
        :aria-label="summary"
      >
        <circle
          cx="50"
          cy="50"
          :r="RADIUS"
          fill="none"
          class="stroke-stone-100"
          stroke-width="14"
        />
        <circle
          v-for="segment in segments"
          :key="segment.label"
          cx="50"
          cy="50"
          :r="RADIUS"
          fill="none"
          class="donut-segment cursor-pointer transition-[stroke-width,opacity] duration-200"
          :stroke="segment.color"
          :stroke-width="active === segment.label ? 18 : 14"
          :stroke-dasharray="segment.dash"
          :stroke-dashoffset="segment.offset"
          :opacity="active && active !== segment.label ? 0.35 : 1"
          :style="{ animationDelay: segment.delay }"
          @pointerenter="hover($event, segment.label)"
          @pointerleave="hover($event, null)"
          @click="select(segment.label)"
        />
      </svg>
      <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span class="text-2xl font-semibold tabular-nums text-stone-900">{{ focused ? focused.value : total }}</span>
        <span class="max-w-[5.5rem] truncate text-[11px] capitalize text-stone-500">{{ focused ? `${focused.name} · ${focused.percent}%` : totalLabel }}</span>
      </div>
    </div>

    <ul class="w-full min-w-0 space-y-1">
      <li
        v-for="segment in segments"
        :key="segment.label"
      >
        <button
          type="button"
          data-compact
          class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-stone-50 max-sm:min-h-11"
          :class="active === segment.label ? 'bg-stone-50' : ''"
          @pointerenter="hover($event, segment.label)"
          @pointerleave="hover($event, null)"
          @click="select(segment.label)"
        >
          <span
            class="size-2.5 shrink-0 rounded-full"
            :style="{ backgroundColor: segment.color }"
          />
          <span class="min-w-0 flex-1 truncate capitalize text-stone-600">{{ segment.name }}</span>
          <span class="tabular-nums text-stone-900">{{ segment.value }}</span>
          <span class="w-9 text-right tabular-nums text-stone-400">{{ segment.percent }}%</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.donut-segment {
  animation: donut-draw 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes donut-draw {
  from {
    stroke-dasharray: 0 264;
  }
}

@media (prefers-reduced-motion: reduce) {
  .donut-segment {
    animation: none;
  }
}
</style>
