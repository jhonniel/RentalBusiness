<script setup lang="ts">
import { fieldErrors, resetPasswordSchema } from '~/utils/auth-validation'

definePageMeta({
  layout: 'auth',
})

useSiteMeta({
  title: 'Choose a new password',
  path: '/reset-password',
})

const supabase = useSupabaseClient()
const session = useSupabaseSession()
const { authErrorMessage } = useAuth()

const form = reactive({
  password: '',
  confirmPassword: '',
})
const errors = ref<Record<string, string>>({})
const formError = ref('')
const pending = ref(false)

async function onSubmit() {
  formError.value = ''
  errors.value = {}

  const parsed = resetPasswordSchema.safeParse(form)
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    return
  }

  if (!session.value) {
    formError.value = 'This reset link is invalid or has expired. Request a new one.'
    return
  }

  pending.value = true

  try {
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    })

    if (error) {
      formError.value = authErrorMessage(error)
      return
    }

    await navigateTo('/dashboard')
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
      title="Choose a new password"
      description="Use at least 8 characters. You will stay signed in after saving."
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
      <AuthInput
        id="password"
        v-model="form.password"
        label="New password"
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

      <UButton
        type="submit"
        color="neutral"
        size="lg"
        block
        class="rounded-xl"
        :loading="pending"
      >
        Save password
      </UButton>
    </form>
  </div>
</template>
