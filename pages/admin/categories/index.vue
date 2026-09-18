<script setup lang="ts">
import type { PublicCategory } from '~/types/catalog'
import { categoryInputSchema } from '~/utils/product-validation'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Categories',
  path: '/admin/categories',
})

const toast = useToast()
const { data: categories, error, pending, refresh } = await useFetch<PublicCategory[]>('/api/admin/categories')
const unavailable = computed(() => error.value?.statusCode === 503)

const form = reactive({
  name: '',
  description: '',
  sortOrder: 0,
  isActive: true,
})
const editingUuid = ref<string | null>(null)
const formError = ref('')
const saving = ref(false)

function startEdit(category: PublicCategory) {
  editingUuid.value = category.uuid
  form.name = category.name
  form.description = category.description ?? ''
  form.sortOrder = category.sortOrder
  form.isActive = category.isActive
}

function resetForm() {
  editingUuid.value = null
  form.name = ''
  form.description = ''
  form.sortOrder = 0
  form.isActive = true
}

async function onSubmit() {
  formError.value = ''
  const parsed = categoryInputSchema.safeParse(form)
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message || 'Check the category details.'
    return
  }

  saving.value = true
  try {
    if (editingUuid.value) {
      await $fetch(`/api/admin/categories/${editingUuid.value}`, {
        method: 'PATCH',
        body: parsed.data,
      })
    }
    else {
      await $fetch('/api/admin/categories', {
        method: 'POST',
        body: parsed.data,
      })
    }
    toast.add({ title: 'Category saved', color: 'success' })
    resetForm()
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not save that category.'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
          Categories
        </h2>
        <p class="mt-1 text-sm text-stone-600">
          Group equipment for admin filters and the public catalog.
        </p>
      </div>
    </div>

    <AdminNotice
      v-if="unavailable"
      title="Catalog is not connected"
      description="Add live Supabase credentials and apply the Phase 2 migrations to manage categories."
    />

    <template v-else>
      <div class="grid gap-6 xl:grid-cols-2 xl:items-start">
        <form
          class="rounded-xl border border-stone-200 bg-white p-5"
          method="post"
          @submit.prevent="onSubmit"
        >
        <h3 class="text-sm font-medium text-stone-900">
          {{ editingUuid ? 'Edit category' : 'New category' }}
        </h3>
        <AuthAlert
          v-if="formError"
          class="mt-4"
          :description="formError"
        />
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Name</span>
            <UInput
              v-model="form.name"
              :disabled="saving"
            />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Sort order</span>
            <UInput
              v-model="form.sortOrder"
              type="number"
              min="0"
              :disabled="saving"
            />
          </label>
          <label class="block text-sm sm:col-span-2">
            <span class="mb-1.5 block text-stone-700">Description</span>
            <UInput
              v-model="form.description"
              :disabled="saving"
            />
          </label>
          <label class="flex items-center gap-2 text-sm text-stone-700">
            <input
              v-model="form.isActive"
              type="checkbox"
              :disabled="saving"
            >
            Active
          </label>
        </div>
        <div class="mt-4 flex gap-2">
          <UButton
            type="submit"
            :loading="saving"
          >
            Save category
          </UButton>
          <UButton
            v-if="editingUuid"
            type="button"
            color="neutral"
            variant="ghost"
            @click="resetForm"
          >
            Cancel
          </UButton>
        </div>
      </form>

      <div class="space-y-3">
        <div
          v-if="pending && !categories"
          class="space-y-3"
        >
          <USkeleton class="h-20 w-full" />
          <USkeleton class="h-20 w-full" />
        </div>

        <AdminNotice
          v-else-if="!categories?.length"
          title="No categories yet"
          description="Create a category before adding products."
        />

        <ul
          v-else
          class="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white"
        >
          <li
            v-for="category in categories"
            :key="category.uuid"
            class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div>
              <p class="font-medium text-stone-900">
                {{ category.name }}
              </p>
              <p class="text-sm text-stone-500">
                {{ category.slug }} · sort {{ category.sortOrder }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <StatusBadge :status="category.isActive ? 'active' : 'hidden'" />
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                @click="startEdit(category)"
              >
                Edit
              </UButton>
            </div>
          </li>
        </ul>
      </div>
      </div>
    </template>
  </div>
</template>
