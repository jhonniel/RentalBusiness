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
  <header class="flex min-h-[4.25rem] items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 sm:px-6">
    <div class="flex min-w-0 items-center gap-3">
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

    <div class="flex shrink-0 items-center gap-2 text-xs text-stone-500 sm:gap-3">
      <span class="hidden max-w-48 truncate sm:inline">{{ profile?.email }}</span>
      <span class="hidden sm:inline">Asia/Manila</span>
      <span class="rounded-full bg-stone-100 px-2 py-1">PHP</span>
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        @click="logout"
      >
        Sign out
      </UButton>
    </div>
  </header>
</template>
