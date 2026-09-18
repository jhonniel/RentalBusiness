<script setup lang="ts">
import type { PublicBusinessSettings } from '~/types/settings'
import { fieldErrors } from '~/utils/auth-validation'
import { businessSettingsInputSchema } from '~/utils/settings-validation'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Settings',
  path: '/admin/settings',
})

const toast = useToast()
const { data, error, pending, refresh } = await useFetch<PublicBusinessSettings>('/api/admin/settings')
const unavailable = computed(() => error.value?.statusCode === 503)

const form = reactive({
  name: '',
  email: '',
  phone: '',
  address: '',
  lateFeePolicy: '',
  depositRules: '',
  cancellationRules: '',
})
const errors = ref<Record<string, string>>({})
const formError = ref('')
const saving = ref(false)

watch(data, (value) => {
  if (!value) {
    return
  }
  form.name = value.name
  form.email = value.email ?? ''
  form.phone = value.phone ?? ''
  form.address = value.address ?? ''
  form.lateFeePolicy = value.lateFeePolicy ?? ''
  form.depositRules = value.depositRules ?? ''
  form.cancellationRules = value.cancellationRules ?? ''
}, { immediate: true })

async function onSubmit() {
  formError.value = ''
  errors.value = {}
  const parsed = businessSettingsInputSchema.safeParse(form)
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    formError.value = parsed.error.issues[0]?.message || 'Check the business details.'
    return
  }

  saving.value = true
  try {
    await $fetch('/api/admin/settings', {
      method: 'PATCH',
      body: parsed.data,
    })
    toast.add({ title: 'Settings saved', color: 'success' })
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not save those settings.'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Operations
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        Settings
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Business details used on receipts. Currency stays PHP and dates stay in Asia/Manila.
      </p>
    </div>

    <AdminMaintenanceEditor />

    <AdminNotice
      v-if="unavailable"
      title="Settings are not connected"
      description="Add live Supabase credentials to load the business profile."
    />

    <USkeleton
      v-else-if="pending && !data"
      class="h-96 w-full"
    />

    <form
      v-else
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
          Business profile
        </h3>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block text-sm sm:col-span-2">
            <span class="mb-1.5 block text-stone-700">Name</span>
            <UInput
              v-model="form.name"
              :disabled="saving"
            />
            <span
              v-if="errors.name"
              class="mt-1 block text-xs text-red-700"
            >{{ errors.name }}</span>
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Email</span>
            <UInput
              v-model="form.email"
              type="email"
              :disabled="saving"
            />
            <span
              v-if="errors.email"
              class="mt-1 block text-xs text-red-700"
            >{{ errors.email }}</span>
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Phone</span>
            <UInput
              v-model="form.phone"
              type="tel"
              :disabled="saving"
            />
          </label>
          <label class="block text-sm sm:col-span-2">
            <span class="mb-1.5 block text-stone-700">Address</span>
            <UInput
              v-model="form.address"
              :disabled="saving"
            />
          </label>
        </div>
      </section>

      <section class="rounded-xl border border-stone-200 bg-white p-5">
        <h3 class="text-sm font-medium text-stone-900">
          Operating defaults
        </h3>
        <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-stone-500">
              Currency
            </dt>
            <dd class="mt-1 text-stone-900">
              {{ data?.currency || 'PHP' }}
            </dd>
          </div>
          <div>
            <dt class="text-stone-500">
              Timezone
            </dt>
            <dd class="mt-1 text-stone-900">
              {{ data?.timezone || 'Asia/Manila' }}
            </dd>
          </div>
        </dl>
      </section>

      <section class="rounded-xl border border-stone-200 bg-white p-5">
        <h3 class="text-sm font-medium text-stone-900">
          Policy copy
        </h3>
        <p class="mt-1 text-sm text-stone-500">
          These notes are stored on the business profile. Product late fees and deposits stay on each kit.
        </p>
        <div class="mt-4 grid gap-4">
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Late fee policy</span>
            <UTextarea
              v-model="form.lateFeePolicy"
              :rows="3"
              :disabled="saving"
            />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Deposit rules</span>
            <UTextarea
              v-model="form.depositRules"
              :rows="3"
              :disabled="saving"
            />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Cancellation rules</span>
            <UTextarea
              v-model="form.cancellationRules"
              :rows="3"
              :disabled="saving"
            />
          </label>
        </div>
      </section>

      <UButton
        type="submit"
        :loading="saving"
      >
        Save settings
      </UButton>
    </form>
  </div>
</template>
