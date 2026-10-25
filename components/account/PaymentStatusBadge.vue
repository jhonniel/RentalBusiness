<script setup lang="ts">
import type { RentalStatus } from '~/utils/constants'
import { customerPaymentStatus } from '~/utils/rental'

const props = defineProps<{
  rental: {
    status: RentalStatus
    totalAmount: number
    depositAmount?: number
    payments?: Array<{ status: string }>
  }
}>()

const state = computed(() => customerPaymentStatus(props.rental))
const toneClass = computed(() => ({
  neutral: 'bg-stone-100 text-stone-700',
  info: 'bg-sky-50 text-sky-800',
  warning: 'bg-amber-50 text-amber-800',
  success: 'bg-emerald-50 text-emerald-800',
  muted: 'bg-stone-100 text-stone-500',
})[state.value.tone])
const icon = computed(() => ({
  neutral: 'i-lucide-circle-dashed',
  info: 'i-lucide-clock',
  warning: 'i-lucide-wallet',
  success: 'i-lucide-circle-check',
  muted: 'i-lucide-minus-circle',
})[state.value.tone])
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
    :class="toneClass"
  >
    <UIcon
      :name="icon"
      class="size-3.5 shrink-0"
    />
    {{ state.label }}
  </span>
</template>
