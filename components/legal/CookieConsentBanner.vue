<script setup lang="ts">
import { COOKIE_CONSENT_STORAGE_KEY, CURRENT_COOKIE_POLICY_VERSION } from '~/utils/constants'

function hasCurrentConsent() {
  if (!import.meta.client) {
    return false
  }

  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) as { version?: string } : null
    return parsed?.version === CURRENT_COOKIE_POLICY_VERSION
  }
  catch {
    return false
  }
}

const accepted = useState('cookie-consent-accepted', () => hasCurrentConsent())

onMounted(() => {
  accepted.value = hasCurrentConsent()
})

function accept() {
  if (import.meta.client) {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify({
      version: CURRENT_COOKIE_POLICY_VERSION,
      acceptedAt: new Date().toISOString(),
    }))
  }
  accepted.value = true
}
</script>

<template>
  <div
    v-if="!accepted"
    class="pointer-events-none fixed bottom-24 left-4 z-[90] w-[min(calc(100%-2rem),24rem)] pb-[env(safe-area-inset-bottom)] sm:bottom-4 sm:left-6"
  >
    <section
      class="pointer-events-auto w-full rounded-2xl border border-[#12201a]/10 bg-white p-4 text-left shadow-[0_18px_40px_rgb(18_32_26_/_16%)]"
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-copy"
    >
      <p
        id="cookie-consent-title"
        class="text-sm font-semibold text-[#12201a]"
      >
        Cookies
      </p>
      <p
        id="cookie-consent-copy"
        class="mt-2 text-sm leading-6 text-[#4a5a54]"
      >
        We use essential cookies to keep you signed in and run bookings. We do not use advertising cookies.
        Read the
        <NuxtLink
          to="/cookies"
          class="font-medium text-[#12201a] underline underline-offset-4"
        >
          Cookie Policy
        </NuxtLink>.
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        <UButton
          type="button"
          @click="accept"
        >
          Accept
        </UButton>
        <UButton
          to="/cookies"
          color="neutral"
          variant="outline"
        >
          Cookie Policy
        </UButton>
      </div>
    </section>
  </div>
</template>
