<script setup lang="ts">
import { formatCountedAmount, splitCountedAmount } from '~/utils/count-up'

const props = defineProps<{
  value: string
}>()

function fromZero(value: string) {
  const parts = splitCountedAmount(value)
  return parts ? formatCountedAmount(parts, 0) : value
}

const text = ref(fromZero(props.value))
const ready = ref(false)
let frame = 0

function show(current: number | null) {
  const parts = splitCountedAmount(props.value)
  text.value = parts && current !== null ? formatCountedAmount(parts, current) : props.value
}

function run(to: number, from: number) {
  cancelAnimationFrame(frame)
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce || from === to) {
    show(to)
    return
  }

  const start = performance.now()
  const step = (now: number) => {
    const progress = Math.min(1, (now - start) / 900)
    const eased = 1 - (1 - progress) ** 3
    show(from + (to - from) * eased)
    if (progress < 1) {
      frame = requestAnimationFrame(step)
    }
  }
  frame = requestAnimationFrame(step)
}

watch(() => props.value, (value, previous) => {
  if (!ready.value) {
    text.value = fromZero(value)
    return
  }

  const next = splitCountedAmount(value)
  if (!next) {
    cancelAnimationFrame(frame)
    text.value = value
    return
  }
  const prior = previous ? splitCountedAmount(previous) : null
  if (!prior) {
    cancelAnimationFrame(frame)
    show(next.number)
    return
  }
  run(next.number, prior.number)
})

onMounted(() => {
  ready.value = true
  const next = splitCountedAmount(props.value)
  if (next) {
    run(next.number, 0)
  }
})

onUnmounted(() => cancelAnimationFrame(frame))
</script>

<template>
  <span>{{ text }}</span>
</template>
