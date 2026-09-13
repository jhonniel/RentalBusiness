<script setup lang="ts">
import type { PublicPrivacyPolicy } from '~/types/privacy'
import type { PublicTerms } from '~/types/terms'

const termsAccepted = defineModel<boolean>('termsAccepted', { required: true })
const privacyAcknowledged = defineModel<boolean>('privacyAcknowledged', { required: true })
const marketingOptIn = defineModel<boolean>('marketingOptIn')

defineProps<{
  termsError?: string
  privacyError?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  agreed: [kind: 'terms' | 'privacy']
}>()

const termsOpen = ref(false)
const privacyOpen = ref(false)

const { data: terms, error: termsLoadError, pending: termsPending } = await useFetch<PublicTerms>('/api/terms/current')
const { data: privacy, error: privacyLoadError, pending: privacyPending } = await useFetch<PublicPrivacyPolicy>('/api/privacy/current')

function agreeTerms() {
  termsAccepted.value = true
  emit('agreed', 'terms')
}

function agreePrivacy() {
  privacyAcknowledged.value = true
  emit('agreed', 'privacy')
}

function openTerms(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  termsOpen.value = true
}

function openPrivacy(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  privacyOpen.value = true
}

watch(termsAccepted, (value) => {
  if (value) {
    emit('agreed', 'terms')
  }
})

watch(privacyAcknowledged, (value) => {
  if (value) {
    emit('agreed', 'privacy')
  }
})
</script>

<template>
  <div class="space-y-3 tracking-normal">
    <AuthCheck
      v-model="termsAccepted"
      :error="termsError"
      :disabled="disabled"
    >
      I agree to the
      <button
        type="button"
        class="inline appearance-none border-0 bg-transparent p-0 font-medium text-[#12201a] underline underline-offset-4"
        @click="openTerms"
      >Terms & Conditions</button>.
    </AuthCheck>
    <AuthCheck
      v-model="privacyAcknowledged"
      :error="privacyError"
      :disabled="disabled"
    >
      I acknowledge the
      <button
        type="button"
        class="inline appearance-none border-0 bg-transparent p-0 font-medium text-[#12201a] underline underline-offset-4"
        @click="openPrivacy"
      >Privacy Policy</button>.
    </AuthCheck>
    <AuthCheck
      v-if="marketingOptIn !== undefined"
      v-model="marketingOptIn"
      :disabled="disabled"
    >
      I would like to receive promotions, rental announcements, and special offers from JRY Rentals. Optional.
    </AuthCheck>

    <AuthPolicyModal
      v-model:open="termsOpen"
      :document="terms"
      fallback-title="Terms & Conditions"
      :load-error="Boolean(termsLoadError)"
      :pending="termsPending"
      :agreed="termsAccepted"
      :disabled="disabled"
      agree-label="I agree to the Terms & Conditions"
      @agree="agreeTerms"
    />
    <AuthPolicyModal
      v-model:open="privacyOpen"
      :document="privacy"
      fallback-title="Privacy Policy"
      :load-error="Boolean(privacyLoadError)"
      :pending="privacyPending"
      :agreed="privacyAcknowledged"
      :disabled="disabled"
      agree-label="I acknowledge the Privacy Policy"
      @agree="agreePrivacy"
    />
  </div>
</template>
