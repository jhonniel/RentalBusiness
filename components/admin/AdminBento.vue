<script setup lang="ts">
withDefaults(defineProps<{
  /** Most tiles per row on the widest screens. */
  columns?: 4 | 6
}>(), {
  columns: 6,
})
</script>

<template>
  <div
    class="grid w-full min-w-0 grid-flow-row-dense grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
    :class="columns === 6 ? 'xl:grid-cols-6' : ''"
  >
    <slot />
  </div>
</template>
