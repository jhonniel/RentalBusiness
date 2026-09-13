<script setup lang="ts">
const props = defineProps<{
  status: string
  light?: boolean
}>()

const label = computed(() => props.status.replaceAll('_', ' '))
const tone = computed(() => {
  if (props.light) {
    return 'bg-white/12 text-white'
  }
  if (['paid', 'approved', 'ready_for_pickup', 'active', 'completed'].includes(props.status)) {
    return 'bg-emerald-50 text-emerald-800'
  }
  if (['draft', 'pending', 'awaiting_payment'].includes(props.status)) {
    return 'bg-amber-50 text-amber-900'
  }
  if (['overdue', 'rejected', 'cancelled'].includes(props.status)) {
    return 'bg-red-50 text-red-800'
  }
  return 'bg-[#eef1ef] text-[#5c6a64]'
})
</script>

<template>
  <span
    class="inline-flex rounded-md px-2 py-1 text-xs font-medium capitalize"
    :class="tone"
  >
    {{ label }}
  </span>
</template>
