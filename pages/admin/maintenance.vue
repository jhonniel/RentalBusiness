<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Maintenance',
  path: '/admin/maintenance',
})
</script>

<template>
  <div class="w-full space-y-6">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Operations
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        Maintenance
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Put the public website behind a maintenance page. Admins can still sign in and use this console.
      </p>
    </div>

    <AdminMaintenanceEditor />
  </div>
</template>
