<script setup lang="ts">
import type { PublicMaintenanceImage, PublicMaintenanceStatus } from '~/types/maintenance'
import { fieldErrors } from '~/utils/auth-validation'
import { DEFAULT_MAINTENANCE_MESSAGE, DEFAULT_MAINTENANCE_TITLE } from '~/utils/maintenance'
import { maintenanceInputSchema } from '~/utils/maintenance-validation'

const toast = useToast()
const { data, error, pending, refresh } = await useFetch<PublicMaintenanceStatus>('/api/admin/maintenance')
const unavailable = computed(() => error.value?.statusCode === 503)

const form = reactive({
  enabled: false,
  title: DEFAULT_MAINTENANCE_TITLE,
  message: DEFAULT_MAINTENANCE_MESSAGE,
})
const errors = ref<Record<string, string>>({})
const formError = ref('')
const saving = ref(false)

const imageAlt = ref('')
const imageInput = ref<HTMLInputElement | null>(null)
const imageFiles = ref<File[]>([])
const imageError = ref('')
const imagePending = ref(false)

watch(data, (value) => {
  if (!value) {
    return
  }
  form.enabled = value.enabled
  form.title = value.title || DEFAULT_MAINTENANCE_TITLE
  form.message = value.message || DEFAULT_MAINTENANCE_MESSAGE
}, { immediate: true })

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  imageFiles.value = input.files ? Array.from(input.files) : []
}

async function onSubmit() {
  formError.value = ''
  errors.value = {}
  const parsed = maintenanceInputSchema.safeParse(form)
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    formError.value = parsed.error.issues[0]?.message || 'Check the maintenance details.'
    return
  }

  saving.value = true
  try {
    await $fetch('/api/admin/maintenance', {
      method: 'PATCH',
      body: parsed.data,
    })
    await refreshNuxtData('site-maintenance')
    toast.add({
      title: parsed.data.enabled ? 'Maintenance is on' : 'Website is live',
      color: 'success',
    })
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not save maintenance settings.'
  }
  finally {
    saving.value = false
  }
}

async function uploadImages() {
  imageError.value = ''
  if (!imageFiles.value.length) {
    imageError.value = 'Choose one or more images to upload.'
    return
  }

  const body = new FormData()
  for (const file of imageFiles.value) {
    body.append('file', file)
  }
  body.append('alt', imageAlt.value)

  imagePending.value = true
  try {
    await $fetch('/api/admin/maintenance/images', {
      method: 'POST',
      body,
    })
    toast.add({ title: 'Images uploaded', color: 'success' })
    imageAlt.value = ''
    imageFiles.value = []
    if (imageInput.value) {
      imageInput.value.value = ''
    }
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    imageError.value = payload?.message || 'We could not upload those images.'
  }
  finally {
    imagePending.value = false
  }
}

async function removeImage(image: PublicMaintenanceImage) {
  imageError.value = ''
  try {
    await $fetch(`/api/admin/maintenance/images/${image.uuid}`, { method: 'DELETE' })
    toast.add({ title: 'Image removed', color: 'success' })
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    imageError.value = payload?.message || 'We could not remove that image.'
  }
}
</script>

<template>
  <div
    id="maintenance"
    class="space-y-6"
  >
    <AdminNotice
      v-if="unavailable"
      title="Maintenance is not connected"
      description="Apply the site maintenance migration in Supabase, then refresh this page."
    />

    <USkeleton
      v-else-if="pending && !data"
      class="h-64 w-full"
    />

    <template v-else>
      <form
        class="space-y-6"
        method="post"
        @submit.prevent="onSubmit"
      >
        <AuthAlert
          v-if="formError"
          :description="formError"
        />

        <section class="rounded-xl border border-stone-200 bg-white p-5">
          <h3 class="text-sm font-medium text-stone-900">
            Website maintenance
          </h3>
          <p class="mt-1 text-sm text-stone-500">
            When this is on, customers see only the maintenance message and images. Admins can still use this console.
          </p>
          <label class="mt-4 flex items-start gap-3 text-sm text-stone-700">
            <input
              v-model="form.enabled"
              type="checkbox"
              class="mt-1"
              :disabled="saving"
            >
            <span>
              <span class="font-medium text-stone-900">Put the website in maintenance</span>
              <span class="mt-1 block text-stone-500">
                {{ form.enabled ? 'Visitors currently see the maintenance page.' : 'The storefront is live.' }}
              </span>
            </span>
          </label>
        </section>

        <section class="rounded-xl border border-stone-200 bg-white p-5">
          <h3 class="text-sm font-medium text-stone-900">
            Message
          </h3>
          <p class="mt-1 text-sm text-stone-500">
            Shown under a Maintenance heading. Use this to explain when you expect to be back.
          </p>
          <div class="mt-4 grid gap-4">
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Title</span>
              <UInput
                v-model="form.title"
                :disabled="saving"
              />
              <span
                v-if="errors.title"
                class="mt-1 block text-xs text-red-700"
              >{{ errors.title }}</span>
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Explanation</span>
              <UTextarea
                v-model="form.message"
                :rows="5"
                :disabled="saving"
              />
              <span
                v-if="errors.message"
                class="mt-1 block text-xs text-red-700"
              >{{ errors.message }}</span>
            </label>
          </div>
        </section>

        <div class="flex flex-wrap gap-2">
          <UButton
            type="submit"
            :loading="saving"
          >
            Save maintenance
          </UButton>
          <UButton
            to="/maintenance"
            color="neutral"
            variant="outline"
            target="_blank"
          >
            Preview page
          </UButton>
        </div>
      </form>

      <section class="rounded-xl border border-stone-200 bg-white p-5">
        <h3 class="text-sm font-medium text-stone-900">
          Images
        </h3>
        <p class="mt-1 text-sm text-stone-500">
          Photos on the public maintenance page. JPG, PNG, or WebP up to 5 MB.
        </p>

        <AuthAlert
          v-if="imageError"
          class="mt-4"
          :description="imageError"
        />

        <form
          class="mt-4 grid gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-[1fr_1fr_auto]"
          method="post"
          @submit.prevent="uploadImages"
        >
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">File</span>
            <input
              ref="imageInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              :disabled="imagePending"
              class="block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:text-stone-800"
              @change="onFileChange"
            >
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Alt text</span>
            <UInput
              v-model="imageAlt"
              :disabled="imagePending"
            />
          </label>
          <UButton
            type="submit"
            :loading="imagePending"
          >
            Upload
          </UButton>
        </form>

        <div
          v-if="data?.images.length"
          class="mt-4 grid gap-3 sm:grid-cols-3"
        >
          <figure
            v-for="image in data.images"
            :key="image.uuid"
            class="overflow-hidden rounded-lg border border-stone-200"
          >
            <img
              :src="image.url"
              :alt="image.alt"
              class="h-36 w-full object-cover"
            >
            <figcaption class="flex items-center justify-between gap-2 px-3 py-2 text-xs text-stone-600">
              <span class="truncate">{{ image.alt || 'Untitled' }}</span>
              <UButton
                color="error"
                variant="ghost"
                size="xs"
                @click="removeImage(image)"
              >
                Remove
              </UButton>
            </figcaption>
          </figure>
        </div>
      </section>
    </template>
  </div>
</template>
