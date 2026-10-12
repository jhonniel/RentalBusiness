<script setup lang="ts">
import type { PublicMaintenanceStatus } from '~/types/maintenance'

const route = useRoute()
const mobileOpen = ref(false)
const { data: maintenance } = await useFetch<PublicMaintenanceStatus>('/api/maintenance', {
  key: 'site-maintenance',
})

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

      <div class="flex min-w-0 w-full flex-1 flex-col">
        <AdminHeader
          title="Operations"
          @open-menu="mobileOpen = true"
        />
        <p
          v-if="maintenance?.enabled"
          class="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950 sm:px-6 lg:px-8"
        >
          The public website is in maintenance.
          <NuxtLink
            to="/admin/settings#maintenance"
            class="font-medium underline underline-offset-2"
          >Edit message</NuxtLink>
        </p>
        <main
          id="main-content"
          class="admin-main min-w-0 w-full max-w-full flex-1 overflow-x-clip px-3 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8"
        >
          <slot />
        </main>
      </div>
    </div>

    <USlideover
      v-model:open="mobileOpen"
      title="Admin menu"
      :ui="{ content: 'w-[min(100vw,20rem)] max-w-[100vw]', body: 'overflow-y-auto p-0' }"
    >
      <template #body>
        <AdminSidebar embedded />
      </template>
    </USlideover>
  </div>
</template>

<style>
.admin-main form label > :not(span):not(input):not(button),
.admin-main form > input,
.admin-main form > select,
.admin-main form > textarea {
  width: 100%;
  max-width: 100%;
}

.admin-main :where(table) {
  max-width: 100%;
}
</style>
