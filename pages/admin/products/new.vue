<script setup lang="ts">
import type { PublicCategory } from '~/types/catalog'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Add product',
  path: '/admin/products/new',
})

const { data: categories, error } = await useFetch<PublicCategory[]>('/api/admin/categories')
const unavailable = computed(() => error.value?.statusCode === 503)

async function onSaved(uuid: string) {
  await navigateTo(`/admin/products/${uuid}`)
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div>
      <UButton
        to="/admin/products"
        color="neutral"
        variant="ghost"
        class="-ml-2"
      >
        Back to products
      </UButton>
      <h2 class="mt-3 text-2xl font-medium text-stone-900">
        Add product
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Set pricing, deposit, inventory, and rental rules. Images and serialized assets can be added after save.
      </p>
    </div>

    <AdminNotice
      v-if="unavailable"
      title="Catalog is not connected"
      description="Add live Supabase credentials and apply the Phase 2 migrations to create products."
    />

    <AdminNotice
      v-else-if="!categories?.length"
      title="Create a category first"
      description="Products must belong to a category before they can be saved."
    >
      <UButton to="/admin/categories">
        Manage categories
      </UButton>
    </AdminNotice>

    <ProductEditor
      v-else
      :categories="categories"
      @saved="onSaved"
    />
  </div>
</template>
