<script setup lang="ts">
import { acceptPoliciesSchema, fieldErrors } from '~/utils/auth-validation'
import { namesFromUserMetadata, needsPolicyAcceptance } from '~/utils/auth'

definePageMeta({
  layout: 'auth',
  middleware: 'auth',
})

useSiteMeta({
  title: 'Accept policies',
  path: '/accept-policies',
})

const route = useRoute()
const user = useSupabaseUser()
const { profile, refreshProfile, redirectAfterLogin, authErrorMessage } = useAuth()

await refreshProfile()

const names = namesFromUserMetadata(user.value?.user_metadata as Record<string, unknown> | undefined)
const form = reactive({
  firstName: profile.value?.firstName || names.firstName,
  lastName: profile.value?.lastName || names.lastName,
  termsAccepted: false,
  privacyAcknowledged: false,
  marketingOptIn: profile.value?.marketingOptIn ?? false,
})
const errors = ref<Record<string, string>>({})
const formError = ref('')
const pending = ref(false)

if (profile.value && !needsPolicyAcceptance(profile.value) && profile.value.firstName && profile.value.lastName) {
  await navigateTo(redirectAfterLogin(route.query.redirect))
}

function onPolicyAgreed(kind: 'terms' | 'privacy') {
  const key = kind === 'terms' ? 'termsAccepted' : 'privacyAcknowledged'
  const next = { ...errors.value }
  delete next[key]
  errors.value = next
}

async function onSubmit() {
  formError.value = ''
  errors.value = {}

  const parsed = acceptPoliciesSchema.safeParse(form)
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    return
  }

  pending.value = true

  try {
    await $fetch('/api/auth/profile', {
      method: 'PATCH',
      body: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        termsAccepted: true,
        privacyAcknowledged: true,
        marketingOptIn: parsed.data.marketingOptIn,
      },
    })
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
</script>

<template>
  <div>
    <AuthPageHeader
      title="Finish setting up your account"
      description="Google created your sign-in. Confirm your name and accept the current Terms and Privacy Policy to continue."
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
          :error="errors.firstName"
          :disabled="pending"
        />
        <AuthInput
          id="lastName"
          v-model="form.lastName"
          label="Last name"
          name="lastName"
          autocomplete="family-name"
          :error="errors.lastName"
          :disabled="pending"
        />
      </div>

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

      <UButton
        type="submit"
        color="neutral"
        size="lg"
        block
        class="rounded-xl"
        :loading="pending"
      >
        Continue
      </UButton>
    </form>
  </div>
</template>
