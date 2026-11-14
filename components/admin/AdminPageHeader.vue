<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div class="min-w-0">
      <p
        v-if="eyebrow"
        class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700"
      >
        {{ eyebrow }}
      </p>
      <h2 class="mt-1.5 text-2xl font-semibold tracking-tight text-stone-900">
        {{ title }}
      </h2>
      <p
        v-if="description"
        class="mt-1 max-w-3xl text-sm leading-6 text-stone-600"
      >
        {{ description }}
      </p>
    </div>
    <div
      v-if="$slots.actions"
      class="flex flex-wrap gap-2 max-sm:[&>*]:flex-1 max-sm:[&>*]:justify-center"
    >
      <slot name="actions" />
    </div>
  </div>
</template>
