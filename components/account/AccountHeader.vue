<script setup lang="ts">
const emit = defineEmits<{
  openMenu: []
}>()

const { logout, profile } = useAuth()

async function handleLogout() {
  await logout()
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-[#12201a]/8 bg-white">
    <div class="flex h-14 min-w-0 items-center justify-between gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
      <div class="flex min-w-0 items-center gap-1.5 sm:gap-3">
        <UButton
          class="lg:hidden"
          color="neutral"
          variant="ghost"
          square
          aria-label="Open account menu"
          @click="emit('openMenu')"
        >
          <UIcon
            name="i-lucide-menu"
            class="size-5"
          />
        </UButton>
        <AppLogo
          compact
          class="max-w-24 lg:hidden sm:max-w-36"
        />
      </div>

      <div class="flex shrink-0 items-center gap-1 sm:gap-2">
        <UButton
          to="/products"
          color="neutral"
          variant="ghost"
          class="hidden rounded-lg text-[#12201a] md:inline-flex"
        >
          Browse equipment
        </UButton>
        <AccountNotificationBell />
        <span class="hidden max-w-40 truncate text-sm text-[#5c6a64] lg:inline">
          {{ profile?.firstName || 'Account' }}
        </span>
        <UButton
          color="neutral"
          variant="outline"
          square
          class="rounded-lg border-[#12201a]/15 sm:hidden"
          aria-label="Sign out"
          @click="handleLogout"
        >
          <UIcon
            name="i-lucide-log-out"
            class="size-4"
          />
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          class="hidden rounded-lg border-[#12201a]/15 sm:inline-flex"
          @click="handleLogout"
        >
          Sign out
        </UButton>
      </div>
    </div>
  </header>
</template>
