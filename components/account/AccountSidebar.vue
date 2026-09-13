<script setup lang="ts">
import { customerNavItems } from '~/utils/navigation'

defineProps<{
  hideBrand?: boolean
}>()

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
  <aside class="flex h-full flex-col border-r border-[#12201a]/8 bg-white">
    <div
      v-if="!hideBrand"
      class="flex h-16 items-center border-b border-[#12201a]/8 px-5"
    >
      <AppLogo />
    </div>

    <nav
      class="flex-1 overflow-y-auto px-3 py-4"
      aria-label="Account"
    >
      <p class="px-3 pb-2 text-xs font-medium tracking-wide text-[#7a8781] uppercase">
        Account
      </p>
      <ul class="space-y-1">
        <li
          v-for="item in customerNavItems"
          :key="item.label"
        >
          <NuxtLink
            v-if="item.to"
            :to="item.to"
            class="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
            :class="isActive(item.to)
              ? 'bg-[#12201a] font-medium text-white'
              : 'text-[#5c6a64] hover:bg-[#f3f4f3] hover:text-[#12201a]'"
          >
            <UIcon
              :name="item.icon"
              class="size-4 shrink-0"
            />
            <span class="min-w-0 break-words">{{ item.label }}</span>
          </NuxtLink>
        </li>
      </ul>

      <p class="mt-6 px-3 pb-2 text-xs font-medium tracking-wide text-[#7a8781] uppercase">
        Shop
      </p>
      <NuxtLink
        to="/products"
        class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#5c6a64] transition-colors hover:bg-[#f3f4f3] hover:text-[#12201a]"
      >
        <UIcon
          name="i-lucide-camera"
          class="size-4 shrink-0"
        />
        Browse equipment
      </NuxtLink>
    </nav>
  </aside>
</template>
