<script setup lang="ts">
defineProps<{
  id: string
  label: string
  error?: string
}>()
</script>

<template>
  <div>
    <label
      :for="id"
      class="mb-2 block text-sm font-medium text-[#12201a]"
    >{{ label }}</label>
    <slot />
    <p
      v-if="error"
      class="mt-1.5 text-xs text-red-700"
    >
      {{ error }}
    </p>
  </div>
</template>
