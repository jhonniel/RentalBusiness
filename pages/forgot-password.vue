<script setup lang="ts">
import { fieldErrors, forgotPasswordSchema } from '~/utils/auth-validation'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
})

useSiteMeta({
  title: 'Reset password',
  path: '/forgot-password',
})

const supabase = useSupabaseClient()
const config = useRuntimeConfig()
const { isConfigured, authErrorMessage } = useAuth()

const email = ref('')
const errors = ref<Record<string, string>>({})
const formError = ref('')
const sent = ref(false)
const pending = ref(false)

async function onSubmit() {
  formError.value = ''
  errors.value = {}

  const parsed = forgotPasswordSchema.safeParse({ email: email.value })
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    return
  }

  if (!isConfigured.value) {
    formError.value = 'Authentication is not configured yet. Add your Supabase keys to continue.'
    return
  }

  pending.value = true

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${config.public.siteUrl}/confirm?next=/reset-password`,
    })

    if (error) {
      formError.value = authErrorMessage(error)
      return
    }

    sent.value = true
  }
  catch (error) {
    formError.value = authErrorMessage(error)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div>
    <AuthPageHeader
      title="Reset your password"
      description="Enter the email on your account. If it exists, we will send a reset link."
    />

    <AuthAlert
      v-if="sent"
      class="mt-6"
      color="success"
      title="Check your email"
      description="If an account exists for that address, a reset link is on its way."
    />

    <AuthAlert
      v-else-if="formError"
      class="mt-6"
      :description="formError"
    />

    <form
      v-if="!sent"
      class="mt-8 space-y-5"
      method="post"
      @submit.prevent="onSubmit"
    >
      <AuthInput
        id="email"
        v-model="email"
        label="Email"
        type="email"
        name="email"
        autocomplete="email"
        icon="i-lucide-mail"
        placeholder="name@example.com"
        :error="errors.email"
        :disabled="pending"
      />

      <UButton
        type="submit"
        color="neutral"
        size="lg"
        block
        class="rounded-xl"
        :loading="pending"
      >
        Send reset link
      </UButton>
    </form>

    <p class="mt-8 text-center text-sm text-[#5b6b64]">
      <NuxtLink
        to="/login"
        class="font-medium text-[#12201a] underline-offset-4 hover:underline"
      >
        Back to sign in
      </NuxtLink>
    </p>
  </div>
</template>
