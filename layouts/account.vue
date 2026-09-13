<script setup lang="ts">
const route = useRoute()
const mobileOpen = ref(false)

watch(() => route.fullPath, () => {
  mobileOpen.value = false
})
</script>

<template>
  <div class="account-shell min-h-dvh overflow-x-clip text-[#12201a]">
    <SkipToContent />
    <div class="flex min-h-dvh">
      <div class="hidden w-64 shrink-0 lg:block">
        <div class="sticky top-0 h-dvh">
          <AccountSidebar />
        </div>
      </div>

      <div class="flex min-w-0 flex-1 flex-col">
        <AccountHeader @open-menu="mobileOpen = true" />
        <main
          id="main-content"
          class="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0"
        >
          <slot />
        </main>
      </div>
    </div>

    <AccountMobileNav />

    <USlideover
      v-model:open="mobileOpen"
      title="Account menu"
    >
      <template #body>
        <AccountSidebar hide-brand />
      </template>
    </USlideover>
  </div>
</template>
