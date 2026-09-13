<script setup lang="ts">
defineProps<{
  title?: string
  description: string
  color?: 'error' | 'success' | 'warning' | 'info'
}>()
</script>

<template>
  <UAlert
    :color="color ?? 'error'"
    :title="title"
    :description="description"
  />
</template>
