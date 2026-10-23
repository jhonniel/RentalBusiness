<script setup lang="ts">
defineProps<{
  open: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  start: []
  cancel: []
  confirm: []
}>()
</script>

<template>
  <UButton
    v-if="!open"
    color="error"
    variant="ghost"
    size="xs"
    @click="emit('start')"
  >
    Delete
  </UButton>
  <span
    v-else
    class="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto"
  >
    <span class="text-xs text-red-800">
      Delete this account? They can no longer sign in. Past bookings stay on record.
    </span>
    <UButton
      color="error"
      size="xs"
      :loading="loading"
      @click="emit('confirm')"
    >
      Confirm delete
    </UButton>
    <UButton
      color="neutral"
      variant="ghost"
      size="xs"
      :disabled="loading"
      @click="emit('cancel')"
    >
      Keep
    </UButton>
  </span>
</template>
