<script setup lang="ts">
import { loginSchema, fieldErrors } from '~/utils/auth-validation'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
})

useSiteMeta({
  title: 'Sign in',
  path: '/login',
})

const route = useRoute()
const supabase = useSupabaseClient()
const { isConfigured, authErrorMessage, refreshProfile, redirectAfterLogin, signInWithGoogle } = useAuth()

const form = reactive({
  email: '',
  password: '',
})
const errors = ref<Record<string, string>>({})
const formError = ref('')
const pending = ref(false)

async function onSubmit() {
  formError.value = ''
  errors.value = {}

  const parsed = loginSchema.safeParse(form)
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
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    })

    if (error) {
      formError.value = authErrorMessage(error)
      return
    }

    await refreshProfile()
    await navigateTo(redirectAfterLogin(route.query.redirect))
  }
  catch (error) {
    formError.value = authErrorMessage(error)
  }
  finally {
    pending.value = false
  }
}

async function onGoogle() {
  formError.value = ''
  errors.value = {}

  if (!isConfigured.value) {
    formError.value = 'Authentication is not configured yet. Add your Supabase keys to continue.'
    return
  }

  pending.value = true

  try {
    await signInWithGoogle({
      redirect: route.query.redirect,
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
      title="Welcome back"
      description="Sign in to manage bookings, receipts, and your profile."
    />

    <AuthAlert
      v-if="formError"
      class="mt-6"
      :description="formError"
    />

    <div class="mt-8 space-y-5">
      <AuthGoogleButton
        :pending="pending"
        label="Continue with Google"
        @click="onGoogle"
      />
      <AuthDivider />
    </div>

    <form
      class="mt-5 space-y-5"
      method="post"
      @submit.prevent="onSubmit"
    >
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
        autocomplete="current-password"
        icon="i-lucide-lock"
        placeholder="Enter your password"
        :error="errors.password"
        :disabled="pending"
      />

      <div class="flex justify-end">
        <NuxtLink
          to="/forgot-password"
          class="text-sm font-medium text-[#12201a] underline-offset-4 hover:underline"
        >
          Forgot password?
        </NuxtLink>
      </div>

      <UButton
        type="submit"
        color="neutral"
        size="lg"
        block
        class="rounded-xl"
        :loading="pending"
      >
        Sign in
      </UButton>
    </form>

    <p class="mt-8 text-center text-sm text-[#5b6b64]">
      New to JRY Rentals?
      <NuxtLink
        to="/register"
        class="font-medium text-[#12201a] underline-offset-4 hover:underline"
      >
        Create an account
      </NuxtLink>
    </p>
  </div>
</template>
