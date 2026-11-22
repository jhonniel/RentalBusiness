<script setup lang="ts">
import type { AdminAddonListResponse, PublicAddon } from '~/types/addon'
import { addonInputSchema } from '~/utils/addon-validation'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Add-ons',
  path: '/admin/addons',
})

const toast = useToast()
const { formatMoney } = useCurrency()
const { data, error, pending, refresh } = await useFetch<AdminAddonListResponse>('/api/admin/addons')
const unavailable = computed(() => error.value?.statusCode === 503)
const ready = computed(() => data.value?.ready ?? false)
const items = computed(() => data.value?.items ?? [])

const form = reactive({
  name: '',
  description: '',
  unitPrice: 0,
  quantity: 0,
  bookable: true,
  status: 'active' as 'active' | 'archived',
})
const editingUuid = ref<string | null>(null)
const formError = ref('')
const saving = ref(false)
const busyUuid = ref<string | null>(null)
const imageFile = ref<File | null>(null)
const imageInput = ref<HTMLInputElement | null>(null)
const editingImageUrl = computed(() => {
  if (!editingUuid.value) {
    return null
  }
  return items.value.find(item => item.uuid === editingUuid.value)?.imageUrl ?? null
})

function resetForm() {
  editingUuid.value = null
  form.name = ''
  form.description = ''
  form.unitPrice = 0
  form.quantity = 0
  form.bookable = true
  form.status = 'active'
  formError.value = ''
  imageFile.value = null
  if (imageInput.value) {
    imageInput.value.value = ''
  }
}

function startEdit(addon: PublicAddon) {
  editingUuid.value = addon.uuid
  form.name = addon.name
  form.description = addon.description
  form.unitPrice = addon.unitPrice
  form.quantity = addon.quantity
  form.bookable = addon.bookable
  form.status = addon.status
  formError.value = ''
  imageFile.value = null
  if (imageInput.value) {
    imageInput.value.value = ''
  }
}

function onImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  imageFile.value = input.files?.[0] ?? null
}

async function uploadImage(uuid: string) {
  if (!imageFile.value) {
    return
  }
  const body = new FormData()
  body.append('file', imageFile.value)
  await $fetch(`/api/admin/addons/${uuid}/image`, {
    method: 'POST',
    body,
  })
}

async function removeImage() {
  if (!editingUuid.value) {
    return
  }
  formError.value = ''
  busyUuid.value = editingUuid.value
  try {
    await $fetch(`/api/admin/addons/${editingUuid.value}/image`, { method: 'DELETE' })
    toast.add({ title: 'Image removed', color: 'success' })
    imageFile.value = null
    if (imageInput.value) {
      imageInput.value.value = ''
    }
    await refresh()
  }
  catch (error) {
    formError.value = errorMessage(error, 'We could not remove that image.')
  }
  finally {
    busyUuid.value = null
  }
}

function errorMessage(error: unknown, fallback: string) {
  const payload = typeof error === 'object' && error && 'data' in error
    ? (error as { data?: { message?: string } }).data
    : null
  return payload?.message || fallback
}

async function onSubmit() {
  formError.value = ''
  const parsed = addonInputSchema.safeParse(form)
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message || 'Check the add-on.'
    return
  }

  saving.value = true
  try {
    const saved = editingUuid.value
      ? await $fetch<PublicAddon>(`/api/admin/addons/${editingUuid.value}`, { method: 'PATCH', body: parsed.data })
      : await $fetch<PublicAddon>('/api/admin/addons', { method: 'POST', body: parsed.data })
    if (imageFile.value) {
      await uploadImage(saved.uuid)
    }
    toast.add({ title: editingUuid.value ? 'Add-on updated' : 'Add-on added', color: 'success' })
    await refresh()
    resetForm()
  }
  catch (error) {
    formError.value = errorMessage(error, 'We could not save that add-on.')
  }
  finally {
    saving.value = false
  }
}

async function toggleBookable(addon: PublicAddon) {
  busyUuid.value = addon.uuid
  try {
    await $fetch(`/api/admin/addons/${addon.uuid}`, {
      method: 'PATCH',
      body: {
        name: addon.name,
        description: addon.description,
        unitPrice: addon.unitPrice,
        quantity: addon.quantity,
        bookable: !addon.bookable,
        status: addon.status,
      },
    })
    toast.add({ title: addon.bookable ? 'Add-on off bookings' : 'Add-on on bookings', color: 'success' })
    await refresh()
  }
  catch (error) {
    toast.add({ title: errorMessage(error, 'We could not update that add-on.'), color: 'error' })
  }
  finally {
    busyUuid.value = null
  }
}

async function archive(addon: PublicAddon) {
  if (!window.confirm(`Archive ${addon.name}? It will leave new bookings.`)) {
    return
  }
  busyUuid.value = addon.uuid
  try {
    await $fetch(`/api/admin/addons/${addon.uuid}/archive`, { method: 'POST' })
    toast.add({ title: 'Add-on archived', color: 'success' })
    if (editingUuid.value === addon.uuid) {
      resetForm()
    }
    await refresh()
  }
  catch (error) {
    toast.add({ title: errorMessage(error, 'We could not archive that add-on.'), color: 'error' })
  }
  finally {
    busyUuid.value = null
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    <AdminPageHeader
      eyebrow="Catalog"
      title="Add-ons"
      description="Paid extras customers can request with a kit. Set stock and turn booking on or off."
    />

    <AdminNotice
      v-if="unavailable"
      title="Add-ons are not connected"
      description="Add live Supabase credentials to manage add-ons."
    />

    <template v-else>
      <AdminBento>
        <AdminStat
          icon="i-lucide-puzzle"
          label="Add-ons"
          :value="String(items.length)"
        />
        <AdminStat
          icon="i-lucide-toggle-right"
          label="On bookings"
          :value="String(items.filter(item => item.bookable && item.status === 'active').length)"
        />
        <AdminStat
          icon="i-lucide-package-x"
          label="Out of stock"
          :value="String(items.filter(item => item.available < 1 && item.status === 'active').length)"
        />
        <AdminStat
          icon="i-lucide-archive"
          label="Archived"
          :value="String(items.filter(item => item.status === 'archived').length)"
        />
      </AdminBento>

      <AdminNotice
        v-if="data && !ready"
        title="Paste the add-ons SQL to start editing"
        description="Run supabase/migrations/20261121140000_product_addons.sql and 20261122130000_addon_images.sql in the Supabase SQL editor, then bind add-ons on each product."
      />

      <div class="grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:items-start">
        <form
          class="rounded-xl border border-stone-200 bg-white p-5"
          method="post"
          @submit.prevent="onSubmit"
        >
          <h3 class="text-sm font-medium text-stone-900">
            {{ editingUuid ? 'Edit add-on' : 'New add-on' }}
          </h3>
          <AuthAlert
            v-if="formError"
            class="mt-4"
            :description="formError"
          />
          <div class="mt-4 space-y-4">
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Name</span>
              <UInput
                v-model="form.name"
                class="w-full"
                maxlength="120"
                placeholder="Extra battery"
                :disabled="saving || !ready"
              />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Description</span>
              <UTextarea
                v-model="form.description"
                class="w-full"
                :rows="3"
                maxlength="1000"
                placeholder="Optional note for the shop and customer."
                :disabled="saving || !ready"
              />
            </label>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-sm">
                <span class="mb-1.5 block text-stone-700">Price (PHP)</span>
                <UInput
                  v-model="form.unitPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  :disabled="saving || !ready"
                />
                <span class="mt-1 block text-xs text-stone-500">
                  Flat fee for the whole booking (not per day).
                </span>
              </label>
              <label class="block text-sm">
                <span class="mb-1.5 block text-stone-700">Quantity in stock</span>
                <UInput
                  v-model="form.quantity"
                  type="number"
                  min="0"
                  step="1"
                  :disabled="saving || !ready"
                />
              </label>
            </div>
            <div class="flex items-center gap-3 text-sm">
              <USwitch
                v-model="form.bookable"
                label="Include on bookings"
                :disabled="saving || !ready"
              />
            </div>
            <div class="space-y-2 text-sm">
              <span class="block text-stone-700">Reference image</span>
              <div
                v-if="editingImageUrl"
                class="flex items-center gap-3"
              >
                <AddonImageThumb
                  :name="form.name || 'Add-on'"
                  :image-url="editingImageUrl"
                  size="md"
                />
                <UButton
                  type="button"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  :disabled="saving || busyUuid === editingUuid"
                  :loading="busyUuid === editingUuid"
                  @click="removeImage"
                >
                  Remove image
                </UButton>
              </div>
              <input
                ref="imageInput"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                class="block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-800"
                :disabled="saving || !ready"
                @change="onImageChange"
              >
              <span class="block text-xs text-stone-500">
                Optional. Shown as a small icon beside the name; tap to view full size.
              </span>
            </div>
          </div>
          <div class="mt-5 flex flex-wrap gap-2">
            <UButton
              type="submit"
              :loading="saving"
              :disabled="!ready"
            >
              {{ editingUuid ? 'Save add-on' : 'Add add-on' }}
            </UButton>
            <UButton
              v-if="editingUuid"
              color="neutral"
              variant="outline"
              type="button"
              :disabled="saving"
              @click="resetForm"
            >
              Cancel
            </UButton>
          </div>
        </form>

        <div class="rounded-xl border border-stone-200 bg-white">
          <div class="border-b border-stone-200 px-5 py-4">
            <h3 class="text-sm font-medium text-stone-900">
              Catalog
            </h3>
            <p class="mt-1 text-sm text-stone-600">
              Bind these to kits on the product edit page.
            </p>
          </div>
          <div
            v-if="pending"
            class="p-5 text-sm text-stone-600"
          >
            Loading add-ons…
          </div>
          <ul
            v-else-if="items.length"
            class="divide-y divide-stone-100"
          >
            <li
              v-for="addon in items"
              :key="addon.uuid"
              class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="flex min-w-0 items-start gap-3">
                <AddonImageThumb
                  :name="addon.name"
                  :image-url="addon.imageUrl"
                />
                <div class="min-w-0">
                <p class="font-medium text-stone-900">
                  {{ addon.name }}
                </p>
                <p class="mt-1 text-sm text-stone-600">
                  {{ formatMoney(addon.unitPrice) }}
                  · {{ addon.available }} available of {{ addon.quantity }}
                  · {{ addon.bookable ? 'On bookings' : 'Off bookings' }}
                  · {{ addon.status === 'archived' ? 'Archived' : 'Active' }}
                </p>
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <UButton
                  size="sm"
                  color="neutral"
                  variant="outline"
                  :disabled="busyUuid === addon.uuid || !ready"
                  @click="startEdit(addon)"
                >
                  Edit
                </UButton>
                <UButton
                  v-if="addon.status === 'active'"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  :loading="busyUuid === addon.uuid"
                  :disabled="!ready"
                  @click="toggleBookable(addon)"
                >
                  {{ addon.bookable ? 'Turn off' : 'Turn on' }}
                </UButton>
                <UButton
                  v-if="addon.status === 'active'"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  :loading="busyUuid === addon.uuid"
                  :disabled="!ready"
                  @click="archive(addon)"
                >
                  Archive
                </UButton>
              </div>
            </li>
          </ul>
          <p
            v-else
            class="p-5 text-sm text-stone-600"
          >
            No add-ons yet.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
