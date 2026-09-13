<script setup lang="ts">
import { APP_NAME } from '~/utils/constants'

withDefaults(defineProps<{
  compact?: boolean
  onDark?: boolean
}>(), {
  compact: false,
  onDark: false,
})
</script>

<template>
  <NuxtLink
    to="/"
    class="inline-flex w-fit shrink-0 items-center bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    :class="onDark ? 'focus-visible:ring-white focus-visible:ring-offset-[#0f1c17]' : 'focus-visible:ring-[#12201a] focus-visible:ring-offset-white'"
  >
    <img
      :src="onDark ? '/logo-on-dark.png?v=12' : '/logo.png?v=12'"
      :alt="APP_NAME"
      class="h-auto w-auto bg-transparent object-contain"
      :class="compact ? 'h-8' : 'h-9 sm:h-10'"
      width="220"
      height="104"
    >
  </NuxtLink>
</template>
