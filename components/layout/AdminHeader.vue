<script setup lang="ts">
defineProps<{
  title: string
}>()

const emit = defineEmits<{
  openMenu: []
}>()

const { profile, logout } = useAuth()
</script>

<template>
  <header class="flex min-h-[4.25rem] items-center justify-between gap-2 border-b border-stone-200 bg-white px-3 sm:gap-3 sm:px-6 lg:px-8">
    <div class="flex min-w-0 items-center gap-2">
      <UButton
        class="lg:hidden"
        color="neutral"
        variant="ghost"
        square
        aria-label="Open admin menu"
        @click="emit('openMenu')"
      >
        <UIcon
          name="i-lucide-menu"
          class="size-5"
        />
      </UButton>
      <h1 class="truncate text-sm font-medium text-stone-900 sm:text-base">
        {{ title }}
      </h1>
    </div>

    <div class="flex min-w-0 items-center gap-1.5 text-xs text-stone-500 sm:gap-3">
      <NuxtLink
        to="/admin/account"
        class="hidden max-w-48 truncate hover:text-stone-800 sm:inline"
      >
        {{ profile?.email }}
      </NuxtLink>
      <span class="hidden md:inline">Asia/Manila</span>
      <span class="rounded-full bg-stone-100 px-2 py-1">PHP</span>
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Sign out"
        @click="logout"
      >
        <UIcon
          name="i-lucide-log-out"
          class="size-4 lg:hidden"
        />
        <span class="hidden lg:inline">Sign out</span>
      </UButton>
    </div>
  </header>
</template>
