<script setup lang="ts">
defineProps<{
  title: string
  description: string
  tone?: 'status' | 'alert'
}>()
</script>

<template>
  <div
    class="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center"
    :role="tone === 'alert' ? 'alert' : 'status'"
  >
    <UIcon
      name="i-lucide-package-search"
      class="mx-auto size-8 text-stone-400"
    />
    <h2 class="mt-4 text-lg font-medium text-stone-900">
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
