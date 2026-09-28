<script setup lang="ts">
import { changePasswordSchema, fieldErrors } from '~/utils/auth-validation'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Account',
  path: '/admin/account',
})

const { profile } = useAuth()
const toast = useToast()

const form = reactive({
  currentPassword: '',
  password: '',
  confirmPassword: '',
})
const errors = ref<Record<string, string>>({})
const formError = ref('')
const saving = ref(false)

async function onSubmit() {
  formError.value = ''
  errors.value = {}

  const parsed = changePasswordSchema.safeParse(form)
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    formError.value = parsed.error.issues[0]?.message || 'Check your password.'
    return
  }

  saving.value = true
  try {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: parsed.data,
    })
    form.currentPassword = ''
    form.password = ''
    form.confirmPassword = ''
    toast.add({ title: 'Password updated', color: 'success' })
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not update your password.'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Operations
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        Account
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Change the password for this system user. Email stays on the signed-in account.
      </p>
    </div>

    <section class="rounded-xl border border-stone-200 bg-white p-5">
      <h3 class="text-sm font-medium text-stone-900">
        Sign-in
      </h3>
      <dl class="mt-4 grid gap-1 text-sm sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
        <dt class="text-stone-500">
          Email
        </dt>
        <dd class="min-w-0 break-all font-medium text-stone-900">
          {{ profile?.email || '—' }}
        </dd>
      </dl>
    </section>

    <form
      class="max-w-md space-y-4 rounded-xl border border-stone-200 bg-white p-5"
      method="post"
      @submit.prevent="onSubmit"
    >
      <h3 class="text-sm font-medium text-stone-900">
        Password
      </h3>
      <p class="text-sm text-stone-500">
        Use at least 8 characters. You will stay signed in after saving.
      </p>

      <AuthAlert
        v-if="formError"
        :description="formError"
      />

      <label class="block text-sm">
        <span class="mb-1.5 block text-stone-700">Current password</span>
        <UInput
          v-model="form.currentPassword"
          type="password"
          autocomplete="current-password"
          :disabled="saving"
        />
        <span
          v-if="errors.currentPassword"
          class="mt-1 block text-xs text-red-700"
        >{{ errors.currentPassword }}</span>
      </label>
      <label class="block text-sm">
        <span class="mb-1.5 block text-stone-700">New password</span>
        <UInput
          v-model="form.password"
          type="password"
          autocomplete="new-password"
          :disabled="saving"
        />
        <span
          v-if="errors.password"
          class="mt-1 block text-xs text-red-700"
        >{{ errors.password }}</span>
      </label>
      <label class="block text-sm">
        <span class="mb-1.5 block text-stone-700">Confirm new password</span>
        <UInput
          v-model="form.confirmPassword"
          type="password"
          autocomplete="new-password"
          :disabled="saving"
        />
        <span
          v-if="errors.confirmPassword"
          class="mt-1 block text-xs text-red-700"
        >{{ errors.confirmPassword }}</span>
      </label>

      <UButton
        type="submit"
        :loading="saving"
      >
        Update password
      </UButton>
    </form>
  </div>
</template>
