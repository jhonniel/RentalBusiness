<script setup lang="ts">
defineProps<{
  title: string
  description: string
  tone?: 'status' | 'alert'
}>()
</script>

<template>
  <div
    class="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center"
    :role="tone === 'alert' ? 'alert' : 'status'"
  >
    <h2 class="text-lg font-medium text-stone-900">
      {{ title }}
    </h2>
    <p class="mx-auto mt-2 max-w-md text-sm text-stone-600">
      {{ description }}
    </p>
    <div
      v-if="$slots.default"
      class="mt-6"
    >
      <slot />
    </div>
  </div>
</template>
