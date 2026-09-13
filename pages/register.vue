<script setup lang="ts">
import { fieldErrors, registerSchema } from '~/utils/auth-validation'
import { rememberPendingPolicies } from '~/utils/auth'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
})

useSiteMeta({
  title: 'Create account',
  path: '/register',
})

const { isConfigured, authErrorMessage, signInWithGoogle } = useAuth()

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  termsAccepted: false,
  privacyAcknowledged: false,
  marketingOptIn: false,
})
const errors = ref<Record<string, string>>({})
const formError = ref('')
const pending = ref(false)

async function onSubmit() {
  formError.value = ''
  errors.value = {}

  const parsed = registerSchema.safeParse(form)
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    return
  }

  if (!isConfigured.value) {
    formError.value = 'Authentication is not configured yet. Add your Supabase keys to continue.'
    return
  }

  pending.value = true
  rememberPendingPolicies({
    termsAccepted: true,
    privacyAcknowledged: true,
    marketingOptIn: parsed.data.marketingOptIn,
  })

  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        password: parsed.data.password,
        termsAccepted: true,
        privacyAcknowledged: true,
        marketingOptIn: parsed.data.marketingOptIn,
      },
    })

    await navigateTo({
      path: '/verify-email',
      query: { email: parsed.data.email },
    })
  }
  catch (error) {
    formError.value = authErrorMessage(error)
  }
  finally {
    pending.value = false
  }
}

function onPolicyAgreed(kind: 'terms' | 'privacy') {
  const key = kind === 'terms' ? 'termsAccepted' : 'privacyAcknowledged'
  const next = { ...errors.value }
  delete next[key]
  errors.value = next
}

async function onGoogle() {
  formError.value = ''
  errors.value = {}

  if (!form.termsAccepted) {
    errors.value.termsAccepted = 'Open the Terms & Conditions and choose I agree to continue.'
  }

  if (!form.privacyAcknowledged) {
    errors.value.privacyAcknowledged = 'Open the Privacy Policy and choose I acknowledge to continue.'
  }

  if (errors.value.termsAccepted || errors.value.privacyAcknowledged) {
    return
  }

  if (!isConfigured.value) {
    formError.value = 'Authentication is not configured yet. Add your Supabase keys to continue.'
    return
  }

  pending.value = true

  try {
    await signInWithGoogle({
      policies: {
        termsAccepted: form.termsAccepted,
        privacyAcknowledged: form.privacyAcknowledged,
        marketingOptIn: form.marketingOptIn,
      },
    })
  }
  catch (error) {
    formError.value = authErrorMessage(error)
    pending.value = false
  }
}
</script>

<template>
  <div>
    <AuthPageHeader
      title="Create your account"
      description="A short verification step, then you can request equipment."
    />

    <AuthAlert
      v-if="formError"
      class="mt-6"
      :description="formError"
    />

    <form
      class="mt-8 space-y-5"
      method="post"
      @submit.prevent="onSubmit"
    >
      <div class="grid gap-5 sm:grid-cols-2">
        <AuthInput
          id="firstName"
          v-model="form.firstName"
          label="First name"
          name="firstName"
          autocomplete="given-name"
          placeholder="Ana"
          :error="errors.firstName"
          :disabled="pending"
        />
        <AuthInput
          id="lastName"
          v-model="form.lastName"
          label="Last name"
          name="lastName"
          autocomplete="family-name"
          placeholder="Santos"
          :error="errors.lastName"
          :disabled="pending"
        />
      </div>

      <AuthInput
        id="email"
        v-model="form.email"
        label="Email"
        type="email"
        name="email"
        autocomplete="email"
        icon="i-lucide-mail"
        placeholder="name@example.com"
        :error="errors.email"
        :disabled="pending"
      />

      <AuthInput
        id="password"
        v-model="form.password"
        label="Password"
        type="password"
        name="password"
        autocomplete="new-password"
        icon="i-lucide-lock"
        placeholder="At least 8 characters"
        :error="errors.password"
        :disabled="pending"
      />

      <AuthInput
        id="confirmPassword"
        v-model="form.confirmPassword"
        label="Confirm password"
        type="password"
        name="confirmPassword"
        autocomplete="new-password"
        icon="i-lucide-lock"
        placeholder="Repeat password"
        :error="errors.confirmPassword"
        :disabled="pending"
      />

      <AuthPolicyAgreement
        v-model:terms-accepted="form.termsAccepted"
        v-model:privacy-acknowledged="form.privacyAcknowledged"
        :terms-error="errors.termsAccepted"
        :privacy-error="errors.privacyAcknowledged"
        :disabled="pending"
        @agreed="onPolicyAgreed"
      />
      <AuthCheck
        v-model="form.marketingOptIn"
        :disabled="pending"
      >
        I would like to receive promotions, rental announcements, and special offers from JRY Rentals. Optional.
      </AuthCheck>

      <AuthGoogleButton
        :pending="pending"
        label="Sign up with Google"
        @click="onGoogle"
      />
      <AuthDivider />

      <UButton
        type="submit"
        color="neutral"
        size="lg"
        block
        class="rounded-xl"
        :loading="pending"
      >
        Create account with email
      </UButton>
    </form>

    <p class="mt-8 text-center text-sm text-[#5b6b64]">
      Already have an account?
      <NuxtLink
        to="/login"
        class="font-medium text-[#12201a] underline-offset-4 hover:underline"
      >
        Sign in
      </NuxtLink>
    </p>
  </div>
</template>
