<script setup lang="ts">
import type { PublicPaymentMethod } from '~/types/payment'
import { paymentMethodInputSchema } from '~/utils/payment-method-validation'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Payments',
  path: '/admin/payments',
})

const toast = useToast()
const { data: methods, error, pending, refresh } = await useFetch<PublicPaymentMethod[]>('/api/admin/payment-methods')
const unavailable = computed(() => error.value?.statusCode === 503)

const form = reactive({
  name: '',
  accountName: '',
  accountNumber: '',
  instructions: '',
  sortOrder: 0,
  isActive: true,
})
const editingUuid = ref<string | null>(null)
const qrFile = ref<File | null>(null)
const qrInput = ref<HTMLInputElement | null>(null)
const logoFile = ref<File | null>(null)
const logoInput = ref<HTMLInputElement | null>(null)
const logoPreviewUrl = ref<string | null>(null)
const formError = ref('')
const saving = ref(false)

function startEdit(method: PublicPaymentMethod) {
  editingUuid.value = method.uuid
  form.name = method.name
  form.accountName = method.accountName ?? ''
  form.accountNumber = method.accountNumber ?? ''
  form.instructions = method.instructions ?? ''
  form.sortOrder = method.sortOrder
  form.isActive = method.isActive
  qrFile.value = null
  if (qrInput.value) {
    qrInput.value.value = ''
  }
  logoFile.value = null
  if (logoInput.value) {
    logoInput.value.value = ''
  }
}

function resetForm() {
  editingUuid.value = null
  form.name = ''
  form.accountName = ''
  form.accountNumber = ''
  form.instructions = ''
  form.sortOrder = 0
  form.isActive = true
  qrFile.value = null
  formError.value = ''
  if (qrInput.value) {
    qrInput.value.value = ''
  }
  logoFile.value = null
  if (logoInput.value) {
    logoInput.value.value = ''
  }
}

const qrPreviewUrl = ref<string | null>(null)
const editingMethod = computed(() => methods.value?.find(method => method.uuid === editingUuid.value) ?? null)

watch(qrFile, (file) => {
  if (qrPreviewUrl.value) {
    URL.revokeObjectURL(qrPreviewUrl.value)
  }
  qrPreviewUrl.value = file ? URL.createObjectURL(file) : null
})

watch(logoFile, (file) => {
  if (logoPreviewUrl.value) {
    URL.revokeObjectURL(logoPreviewUrl.value)
  }
  logoPreviewUrl.value = file ? URL.createObjectURL(file) : null
})

onBeforeUnmount(() => {
  if (qrPreviewUrl.value) {
    URL.revokeObjectURL(qrPreviewUrl.value)
  }
  if (logoPreviewUrl.value) {
    URL.revokeObjectURL(logoPreviewUrl.value)
  }
})

function onLogoChange(event: Event) {
  const input = event.target as HTMLInputElement
  logoFile.value = input.files?.[0] ?? null
}

async function uploadLogo(uuid: string) {
  if (!logoFile.value) {
    return
  }

  const body = new FormData()
  body.append('file', logoFile.value)
  await $fetch(`/api/admin/payment-methods/${uuid}/logo`, {
    method: 'POST',
    body,
  })
}

async function removeLogo(method: PublicPaymentMethod) {
  formError.value = ''
  try {
    await $fetch(`/api/admin/payment-methods/${method.uuid}/logo`, { method: 'DELETE' })
    toast.add({ title: 'Logo removed', color: 'success' })
    if (editingUuid.value === method.uuid) {
      logoFile.value = null
    }
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not remove that logo.'
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  qrFile.value = input.files?.[0] ?? null
}

async function uploadQr(uuid: string) {
  if (!qrFile.value) {
    return
  }

  const body = new FormData()
  body.append('file', qrFile.value)
  await $fetch(`/api/admin/payment-methods/${uuid}/qr`, {
    method: 'POST',
    body,
  })
}

async function onSubmit() {
  formError.value = ''
  const parsed = paymentMethodInputSchema.safeParse(form)
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message || 'Check the payment method details.'
    return
  }

  saving.value = true
  try {
    const saved = editingUuid.value
      ? await $fetch<PublicPaymentMethod>(`/api/admin/payment-methods/${editingUuid.value}`, {
          method: 'PATCH',
          body: parsed.data,
        })
      : await $fetch<PublicPaymentMethod>('/api/admin/payment-methods', {
          method: 'POST',
          body: parsed.data,
        })

    await uploadLogo(saved.uuid)
    await uploadQr(saved.uuid)
    toast.add({ title: 'Payment method saved', color: 'success' })
    resetForm()
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not save that payment method.'
  }
  finally {
    saving.value = false
  }
}

async function removeQr(method: PublicPaymentMethod) {
  formError.value = ''
  try {
    await $fetch(`/api/admin/payment-methods/${method.uuid}/qr`, { method: 'DELETE' })
    toast.add({ title: 'QR image removed', color: 'success' })
    if (editingUuid.value === method.uuid) {
      qrFile.value = null
    }
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not remove that QR image.'
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Finance
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        Payment methods
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Add GCash, Maya, or bank details, a logo, and the QR customers should scan.
      </p>
    </div>

    <AdminNotice
      v-if="unavailable"
      title="Payments are not connected"
      description="Add live Supabase credentials and apply the Phase 16 migration to manage payment methods."
    />

    <template v-else>
      <div class="grid gap-6 xl:grid-cols-2 xl:items-start">
        <form
          class="rounded-xl border border-stone-200 bg-white p-5"
          method="post"
          @submit.prevent="onSubmit"
        >
          <h3 class="text-sm font-medium text-stone-900">
            {{ editingUuid ? 'Edit payment method' : 'New payment method' }}
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
                placeholder="GCash"
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
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Account name</span>
              <UInput
                v-model="form.accountName"
                placeholder="JRY Rentals"
                :disabled="saving"
              />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Account or mobile number</span>
              <UInput
                v-model="form.accountNumber"
                placeholder="09XX XXX XXXX"
                :disabled="saving"
              />
            </label>
            <label class="block text-sm sm:col-span-2">
              <span class="mb-1.5 block text-stone-700">Instructions</span>
              <UTextarea
                v-model="form.instructions"
                :rows="3"
                placeholder="Send the rental total, then message us the reference number."
                :disabled="saving"
              />
            </label>
            <label class="block text-sm sm:col-span-2">
              <span class="mb-1.5 block text-stone-700">
                {{ editingMethod?.logoUrl ? 'Replace logo' : 'Logo' }}
              </span>
              <span
                v-if="logoPreviewUrl || editingMethod?.logoUrl"
                class="mb-3 flex items-center gap-3"
              >
                <span class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-white p-1.5">
                  <img
                    :src="logoPreviewUrl || editingMethod?.logoUrl || ''"
                    :alt="logoPreviewUrl ? 'New logo preview' : `${editingMethod?.name} logo`"
                    class="size-full object-contain"
                  >
                </span>
                <span class="text-xs text-stone-500">
                  {{ logoPreviewUrl ? 'New logo. It uploads when you save.' : 'Current logo shown to customers.' }}
                </span>
              </span>
              <input
                ref="logoInput"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                class="block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:text-stone-800"
                :disabled="saving"
                @change="onLogoChange"
              >
              <p class="mt-1 text-xs text-stone-500">
                Square logo works best, for example the GCash or bank logo. PNG keeps a transparent background.
              </p>
            </label>
            <label class="block text-sm sm:col-span-2">
              <span class="mb-1.5 block text-stone-700">
                {{ editingMethod?.qrUrl ? 'Replace QR image' : 'QR image' }}
              </span>
              <span
                v-if="qrPreviewUrl || editingMethod?.qrUrl"
                class="mb-3 flex items-center gap-3"
              >
                <span class="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50 p-1">
                  <img
                    :src="qrPreviewUrl || editingMethod?.qrUrl || ''"
                    :alt="qrPreviewUrl ? 'New QR preview' : `${editingMethod?.name} QR`"
                    class="size-full object-contain"
                  >
                </span>
                <span class="text-xs text-stone-500">
                  {{ qrPreviewUrl ? 'New image. It uploads when you save.' : 'Current QR shown to customers.' }}
                </span>
              </span>
              <input
                ref="qrInput"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                class="block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:text-stone-800"
                :disabled="saving"
                @change="onFileChange"
              >
              <p class="mt-1 text-xs text-stone-500">
                JPG, PNG, WebP, or HEIC up to 15 MB. Compressed to JPEG before it is stored on Supabase Storage.
              </p>
            </label>
            <label class="flex items-center gap-2 text-sm text-stone-700">
              <input
                v-model="form.isActive"
                type="checkbox"
                :disabled="saving"
              >
              Show to customers
            </label>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <UButton
              type="submit"
              :loading="saving"
            >
              Save method
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
            v-if="pending && !methods"
            class="space-y-3"
          >
            <USkeleton class="h-24 w-full" />
            <USkeleton class="h-24 w-full" />
          </div>

          <AdminNotice
            v-else-if="!methods?.length"
            title="No payment methods yet"
            description="Add GCash, Maya, or a bank account so customers can scan a QR at checkout."
          />

          <ul
            v-else
            class="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white"
          >
            <li
              v-for="method in methods"
              :key="method.uuid"
              class="flex flex-wrap items-start gap-4 px-4 py-4"
            >
              <div class="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
                <img
                  v-if="method.qrUrl"
                  :src="method.qrUrl"
                  :alt="`${method.name} QR`"
                  class="size-full object-contain"
                >
                <span
                  v-else
                  class="px-2 text-center text-[11px] text-stone-400"
                >
                  No QR
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-2 font-medium text-stone-900">
                  <span
                    v-if="method.logoUrl"
                    class="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-white p-0.5"
                  >
                    <img
                      :src="method.logoUrl"
                      :alt="`${method.name} logo`"
                      class="size-full object-contain"
                    >
                  </span>
                  {{ method.name }}
                </p>
                <p class="text-sm text-stone-500">
                  {{ method.accountName || 'No account name' }}
                  <template v-if="method.accountNumber">
                    · {{ method.accountNumber }}
                  </template>
                </p>
                <p
                  v-if="method.instructions"
                  class="mt-1 line-clamp-2 text-sm text-stone-600"
                >
                  {{ method.instructions }}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <StatusBadge :status="method.isActive ? 'active' : 'hidden'" />
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="startEdit(method)"
                >
                  Edit
                </UButton>
                <UButton
                  v-if="method.qrUrl"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="removeQr(method)"
                >
                  Remove QR
                </UButton>
                <UButton
                  v-if="method.logoUrl"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="removeLogo(method)"
                >
                  Remove logo
                </UButton>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>
