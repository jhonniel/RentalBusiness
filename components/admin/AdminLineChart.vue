<script setup lang="ts">
import { maskCountedAmount } from '~/utils/count-up'

interface LinePoint {
  label: string
  value: number
}

const props = withDefaults(defineProps<{
  points: LinePoint[]
  format?: (value: number) => string
  formatAxis?: (value: number) => string
  formatLabel?: (label: string) => string
  formatTick?: (label: string) => string
  concealed?: boolean
}>(), {
  format: (value: number) => String(value),
  formatAxis: undefined,
  formatLabel: (label: string) => label,
  formatTick: (label: string) => label,
  concealed: false,
})

const active = ref<number | null>(null)
const root = ref<HTMLElement | null>(null)
const { play, replay } = useChartPlay(root)
const gradientId = useId()

function niceMax(raw: number) {
  if (raw <= 0) {
    return 1
  }
  const power = 10 ** Math.floor(Math.log10(raw))
  const scaled = raw / power
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return nice * power
}

const shown = (value: number) => props.concealed ? maskCountedAmount(props.format(value)) : props.format(value)
const axis = (value: number) => props.concealed
  ? maskCountedAmount((props.formatAxis ?? props.format)(value))
  : (props.formatAxis ?? props.format)(value)
const max = computed(() => niceMax(Math.max(0, ...props.points.map(point => point.value))))
const total = computed(() => props.points.reduce((sum, point) => sum + point.value, 0))
const focused = computed(() => active.value === null ? null : props.points[active.value] ?? null)
const summary = computed(() => props.concealed
  ? 'Sales amounts are hidden'
  : props.points.map(point => `${props.formatLabel(point.label)}: ${props.format(point.value)}`).join(', '))

const coords = computed(() => props.points.map((point, index) => ({
  x: ((index + 0.5) / Math.max(1, props.points.length)) * 100,
  y: 100 - Math.max(0, Math.min(100, (point.value / max.value) * 100)),
})))

const linePath = computed(() => coords.value
  .map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x},${coord.y}`)
  .join(' '))

const areaPath = computed(() => {
  const first = coords.value[0]
  const last = coords.value[coords.value.length - 1]
  return first && last ? `${linePath.value} L${last.x},100 L${first.x},100 Z` : ''
})

const animationKey = computed(() => props.points.map(point => `${point.label}=${point.value}`).join(','))

watch(animationKey, () => replay())

function hover(event: PointerEvent, index: number | null) {
  if (event.pointerType === 'mouse') {
    active.value = index
  }
}
</script>

<template>
  <div ref="root">
    <div class="flex min-h-11 items-baseline justify-between gap-3">
      <p class="min-w-0 truncate text-sm text-stone-500">
        {{ focused ? formatLabel(focused.label) : 'Total' }}
      </p>
      <p class="shrink-0 text-lg font-semibold tabular-nums text-stone-900">
        <AdminCount :value="shown(focused ? focused.value : total)" />
      </p>
    </div>

    <div class="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
      <div class="flex h-40 flex-col justify-between text-right text-[11px] tabular-nums text-stone-400 sm:h-48">
        <span>{{ axis(max) }}</span>
        <span>{{ axis(max / 2) }}</span>
        <span>{{ axis(0) }}</span>
      </div>

      <div
        class="relative h-40 sm:h-48"
        role="img"
        :aria-label="summary"
      >
        <div class="pointer-events-none absolute inset-0 flex flex-col justify-between">
          <span class="border-t border-stone-100" />
          <span class="border-t border-stone-100" />
          <span class="border-t border-stone-300" />
        </div>

        <svg
          :key="animationKey"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          class="pointer-events-none absolute inset-0 size-full overflow-visible text-lumen-700"
          :class="play ? 'line-reveal' : 'line-hold'"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              :id="gradientId"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop
                offset="0%"
                stop-color="currentColor"
                stop-opacity="0.22"
              />
              <stop
                offset="100%"
                stop-color="currentColor"
                stop-opacity="0"
              />
            </linearGradient>
          </defs>
          <path
            :d="areaPath"
            :fill="`url(#${gradientId})`"
          />
          <path
            :d="linePath"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
            vector-effect="non-scaling-stroke"
          />
        </svg>

        <span
          v-if="active !== null && coords[active]"
          class="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-stone-300"
          :style="{ left: `${coords[active]!.x}%` }"
        />
        <span
          v-for="(coord, index) in coords"
          :key="`dot-${index}`"
          class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-lumen-700 shadow-sm transition-[width,height] duration-150"
          :class="[active === index ? 'size-3.5' : 'size-2', play ? 'chart-fade' : 'opacity-0']"
          :style="{ left: `${coord.x}%`, top: `${coord.y}%`, animationDelay: `${200 + index * 40}ms` }"
        />

        <div class="absolute inset-0 flex">
          <button
            v-for="(point, index) in points"
            :key="point.label"
            type="button"
            data-compact
            class="h-full min-w-0 flex-1 focus-visible:outline-none"
            :aria-label="concealed ? formatLabel(point.label) : `${formatLabel(point.label)}: ${format(point.value)}`"
            :title="concealed ? formatLabel(point.label) : `${formatLabel(point.label)} · ${format(point.value)}`"
            @pointerenter="hover($event, index)"
            @pointerleave="hover($event, null)"
            @focus="active = index"
            @blur="active = null"
            @click="active = index"
          />
        </div>
      </div>

      <span />
      <div class="mt-1.5 flex">
        <span
          v-for="(point, index) in points"
          :key="point.label"
          class="min-w-0 flex-1 truncate text-center text-[10px] tabular-nums sm:text-[11px]"
          :class="active === index ? 'font-semibold text-stone-900' : 'text-stone-400'"
        >{{ formatTick(point.label) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-hold {
  clip-path: inset(-10% 100% -10% 0);
}

.line-reveal {
  animation: line-reveal 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes line-reveal {
  from {
    clip-path: inset(-10% 100% -10% 0);
  }
  to {
    clip-path: inset(-10% 0 -10% 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .line-reveal {
    animation: none;
  }
}
</style>
