<script setup lang="ts">
const route = useRoute()
const mobileOpen = ref(false)

watch(() => route.fullPath, () => {
  mobileOpen.value = false
})
</script>

<template>
  <div class="min-h-dvh overflow-x-clip bg-slate-50">
    <SkipToContent />
    <div class="flex min-h-dvh">
      <div class="hidden w-64 shrink-0 lg:block">
        <div class="sticky top-0 h-dvh">
          <AdminSidebar />
        </div>
      </div>

      <div class="flex min-w-0 flex-1 flex-col">
        <AdminHeader
          title="Operations"
          @open-menu="mobileOpen = true"
        />
        <main
          id="main-content"
          class="min-w-0 flex-1 px-3 py-5 sm:px-6 sm:py-6"
        >
          <slot />
        </main>
      </div>
    </div>

    <USlideover
      v-model:open="mobileOpen"
      title="Admin menu"
    >
      <template #body>
        <AdminSidebar />
      </template>
    </USlideover>
  </div>
</template>
