<script setup lang="ts">
import { customerNavItems } from '~/utils/navigation'

const route = useRoute()
</script>

<template>
  <nav
    class="touch-scroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
    aria-label="Account"
  >
    <NuxtLink
      v-for="item in customerNavItems"
      :key="item.label"
      :to="item.to"
      class="rounded-full px-3 py-1.5 text-sm whitespace-nowrap"
      :class="route.path === item.to
        ? 'bg-lumen-800 text-white'
        : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:text-stone-900'"
    >
      {{ item.label }}
    </NuxtLink>
  </nav>
</template>
