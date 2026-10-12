<script setup lang="ts">
import { adminNavItems } from '~/utils/navigation'

const route = useRoute()

defineProps<{
  compact?: boolean
  embedded?: boolean
}>()

function isActive(to?: string) {
  if (!to) {
    return false
  }

  if (to === '/admin') {
    return route.path === '/admin'
  }

  if (route.path === to) {
    return true
  }

  const moreSpecific = adminNavItems.some(item =>
    item.to
    && item.to.length > to.length
    && (route.path === item.to || route.path.startsWith(`${item.to}/`)),
  )

  return !moreSpecific && route.path.startsWith(`${to}/`)
}
</script>

<template>
  <aside
    class="flex flex-col bg-white"
    :class="embedded ? 'min-h-full border-0' : 'h-full border-r border-stone-200'"
  >
    <div class="flex h-[4.25rem] items-center border-b border-stone-200 px-4">
      <AppLogo :compact="compact" />
    </div>

    <nav
      class="px-3 py-4"
      :class="embedded ? 'pb-8' : 'min-h-0 flex-1 overflow-y-auto'"
      aria-label="Admin"
    >
      <ul class="space-y-1">
        <li
          v-for="item in adminNavItems"
          :key="item.label"
        >
          <NuxtLink
            v-if="item.enabled && item.to"
            :to="item.to"
            class="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
            :class="isActive(item.to)
              ? 'bg-lumen-50 text-lumen-800'
              : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'"
          >
            <UIcon
              :name="item.icon"
              class="size-4 shrink-0"
            />
            <span
              v-if="!compact"
              class="min-w-0 break-words"
            >{{ item.label }}</span>
          </NuxtLink>
          <span
            v-else
            class="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-stone-400"
            :title="`${item.label} arrives in a later phase`"
          >
            <UIcon
              :name="item.icon"
              class="size-4 shrink-0"
            />
            <span
              v-if="!compact"
              class="flex w-full items-center justify-between"
            >
              {{ item.label }}
              <span class="text-[10px] uppercase tracking-wider">Soon</span>
            </span>
          </span>
        </li>
      </ul>
    </nav>
  </aside>
</template>
