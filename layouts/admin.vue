<script setup lang="ts">
const mobileOpen = ref(false)
</script>

<template>
  <div class="min-h-dvh bg-slate-50">
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
          class="flex-1 px-4 py-6 sm:px-6"
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
