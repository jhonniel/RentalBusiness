<script setup lang="ts">
const route = useRoute()
const mobileOpen = ref(false)
const { logout } = useAuth()

const links = [
  { label: 'Bookings', to: '/commissioner' },
  { label: 'New booking', to: '/commissioner/bookings/new' },
]

watch(() => route.fullPath, () => {
  mobileOpen.value = false
})

function isActive(to: string) {
  return to === '/commissioner' ? route.path === '/commissioner' : route.path.startsWith(to)
}
</script>

<template>
  <div class="min-h-dvh overflow-x-clip bg-slate-50">
    <SkipToContent />
    <header class="border-b border-stone-200 bg-white">
      <div class="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <AppLogo />
        <nav
          class="hidden items-center gap-1 sm:flex"
          aria-label="Commissioner"
        >
          <NuxtLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="rounded-md px-3 py-2 text-sm"
            :class="isActive(link.to) ? 'bg-lumen-50 text-lumen-800' : 'text-stone-600 hover:bg-stone-50'"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
        <div class="flex items-center gap-2">
          <UButton
            class="sm:hidden"
            color="neutral"
            variant="ghost"
            @click="mobileOpen = true"
          >
            Menu
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            @click="logout"
          >
            Sign out
          </UButton>
        </div>
      </div>
    </header>
    <main
      id="main-content"
      class="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8"
    >
      <slot />
    </main>
    <USlideover
      v-model:open="mobileOpen"
      title="Commissioner"
    >
      <template #body>
        <nav
          class="flex flex-col gap-1"
          aria-label="Commissioner"
        >
          <NuxtLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="rounded-md px-3 py-2 text-sm"
            :class="isActive(link.to) ? 'bg-lumen-50 text-lumen-800' : 'text-stone-700'"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
      </template>
    </USlideover>
  </div>
</template>
