<script setup lang="ts">
import {
  AUTH_NEXT_STORAGE_KEY,
  authCallbackOtpType,
  clearPendingPolicies,
  namesFromUserMetadata,
  needsPolicyAcceptance,
  policiesFromUserMetadata,
  readPendingPolicies,
} from '~/utils/auth'

definePageMeta({
  layout: 'auth',
})

useSiteMeta({
  title: 'Confirming account',
  path: '/confirm',
})

const route = useRoute()
const supabase = useSupabaseClient()
const session = useSupabaseSession()
const user = useSupabaseUser()
const { refreshProfile, redirectAfterLogin, authErrorMessage, authHeaders } = useAuth()
const message = ref('Please wait while we activate your account.')
const failed = ref(false)
const title = computed(() => failed.value ? 'Could not confirm your account' : 'Confirming your account')

onMounted(() => {
  void completeConfirmation()
})

async function completeConfirmation() {
  const oauthError = typeof route.query.error === 'string' ? route.query.error : ''
  const oauthDescription = typeof route.query.error_description === 'string'
    ? route.query.error_description
    : oauthError

  if (oauthError) {
    failed.value = true
    message.value = authErrorMessage(oauthDescription)
    return
  }

  try {
    const signedIn = await establishSession()
    if (!signedIn) {
      failed.value = true
      message.value = 'This confirmation link is invalid or has expired. Request a new one from the verify email page.'
      return
    }

    await finishSignedIn()
  }
  catch (error) {
    failed.value = true
    message.value = authErrorMessage(error)
  }
}

async function establishSession() {
  const code = typeof route.query.code === 'string' ? route.query.code : ''
  const tokenHash = typeof route.query.token_hash === 'string' ? route.query.token_hash : ''

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return true
    }

    const { data } = await supabase.auth.getSession()
    if (data.session) {
      return true
    }

    throw error
  }

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: authCallbackOtpType(route.query.type),
    })

    if (error) {
      throw error
    }

    return true
  }

  for (let attempt = 0; attempt < 16; attempt += 1) {
    if (session.value) {
      return true
    }

    const { data } = await supabase.auth.getSession()
    if (data.session) {
      return true
    }

    await new Promise(resolve => setTimeout(resolve, 250))
  }

  return Boolean(session.value)
}

async function finishSignedIn() {
  const next = sessionStorage.getItem(AUTH_NEXT_STORAGE_KEY)
  sessionStorage.removeItem(AUTH_NEXT_STORAGE_KEY)

  let profile = await refreshProfile()
  if (!profile) {
    await new Promise(resolve => setTimeout(resolve, 400))
    profile = await refreshProfile()
  }

  const metadata = user.value?.user_metadata as Record<string, unknown> | undefined
  const pendingPolicies = readPendingPolicies() || policiesFromUserMetadata(metadata)
  const names = namesFromUserMetadata(metadata)
  const firstName = profile?.firstName || names.firstName
  const lastName = profile?.lastName || names.lastName

  if (pendingPolicies && profile && firstName && lastName && needsPolicyAcceptance(profile)) {
    try {
      profile = await $fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: authHeaders(),
        body: {
          firstName,
          lastName,
          termsAccepted: true,
          privacyAcknowledged: true,
          marketingOptIn: pendingPolicies.marketingOptIn,
        },
      })
    }
    catch {
      // Keep the signed-in session. Accept-policies can finish this if the stamp fails.
    }
    finally {
      clearPendingPolicies()
    }
  }
  else {
    clearPendingPolicies()
  }

  if (needsPolicyAcceptance(profile)) {
    await navigateTo({
      path: '/accept-policies',
      query: next ? { redirect: next } : undefined,
    })
    return
  }

  await navigateTo(redirectAfterLogin(next || route.query.next, profile?.role))
}

const showLoginLink = computed(() =>
  failed.value
  || message.value.includes('expired')
  || message.value.includes('Google')
  || message.value.includes('cancelled')
  || message.value.includes('same browser'),
)
</script>

<template>
  <div>
    <AuthPageHeader
      :title="title"
      :description="failed
        ? 'The confirmation link did not work. Request a new email and open it in this same browser.'
        : 'Please wait while we activate your account.'"
    />

    <div
      v-if="!failed"
      class="mt-8 flex items-center gap-3 text-sm leading-6 text-[#5b6b64]"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-5 shrink-0 animate-spin"
      />
      <p>{{ message }}</p>
    </div>

    <AuthAlert
      v-else
      class="mt-6"
      :description="message"
    />

    <div
      v-if="showLoginLink"
      class="mt-8 space-y-3"
    >
      <UButton
        to="/verify-email"
        color="neutral"
        size="lg"
        block
        class="rounded-xl"
      >
        Resend confirmation email
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
