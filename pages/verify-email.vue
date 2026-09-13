<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

useSiteMeta({
  title: 'Verify email',
  path: '/verify-email',
})

const route = useRoute()
const { isConfigured, authErrorMessage } = useAuth()

const email = computed(() => typeof route.query.email === 'string' ? route.query.email : '')
const formError = ref('')
const sent = ref(false)
const pending = ref(false)

async function resend() {
  formError.value = ''
  sent.value = false

  if (!email.value || !isConfigured.value) {
    formError.value = 'Open this page from the registration screen to resend a verification email.'
    return
  }

  pending.value = true

  try {
    await $fetch('/api/auth/resend-confirmation', {
      method: 'POST',
      body: { email: email.value },
    })

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
      title="Verify your email"
      :description="email
        ? `We sent a confirmation link to ${email}. Open it in this same browser to activate your account.`
        : 'We sent a confirmation link. Open it in this same browser to activate your account.'"
    />

    <AuthAlert
      v-if="sent"
      class="mt-6"
      color="success"
      description="A new confirmation email is on its way."
    />
    <AuthAlert
      v-else-if="formError"
      class="mt-6"
      :description="formError"
    />

    <div class="mt-8 space-y-3">
      <UButton
        color="neutral"
        size="lg"
        block
        class="rounded-xl"
        :loading="pending"
        @click="resend"
      >
        Resend confirmation
      </UButton>
      <UButton
        to="/login"
        color="neutral"
        variant="ghost"
        size="lg"
        block
        class="rounded-xl"
      >
        Back to sign in
      </UButton>
    </div>
  </div>
</template>
