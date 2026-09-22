<script setup lang="ts">
const props = defineProps<{
  status: string
}>()

const color = computed(() => {
  if (['active', 'available', 'paid', 'approved', 'completed'].includes(props.status)) {
    return 'success' as const
  }
  if (['draft', 'pending', 'hidden', 'coming_soon', 'reserved', 'maintenance', 'awaiting_payment', 'paused', 'scheduled'].includes(props.status)) {
    return 'warning' as const
  }
  if (['archived', 'lost', 'retired', 'damaged', 'cancelled', 'rejected', 'overdue', 'void', 'disabled', 'expired'].includes(props.status)) {
    return 'error' as const
  }
  return 'neutral' as const
})
</script>

<template>
  <UBadge
    :color="color"
    variant="subtle"
    class="capitalize"
  >
    {{ status.replaceAll('_', ' ') }}
  </UBadge>
</template>
