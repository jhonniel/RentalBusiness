<script setup lang="ts">
import { customerNavItems } from '~/utils/navigation'

const route = useRoute()

function isActive(to?: string) {
  if (!to) {
    return false
  }
  if (route.path === to) {
    return true
  }
  return to === '/my-rentals' && route.path.startsWith('/rentals')
}
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-40 border-t border-[#12201a]/8 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    aria-label="Account pages"
  >
    <ul class="grid grid-cols-3">
      <li
        v-for="item in customerNavItems"
        :key="item.label"
      >
        <NuxtLink
          v-if="item.to"
          :to="item.to"
          class="flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium"
          :class="isActive(item.to) ? 'text-[#12201a]' : 'text-[#7a8781]'"
        >
          <UIcon
            :name="item.icon"
            class="size-5"
          />
          {{ item.label === 'My rentals' ? 'Rentals' : item.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
