<script setup lang="ts">
import type { PublicPrivacyPolicy } from '~/types/privacy'
import type { PublicTerms } from '~/types/terms'

const termsAccepted = defineModel<boolean>('termsAccepted', { required: true })
const privacyAcknowledged = defineModel<boolean>('privacyAcknowledged', { required: true })

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
</script>

<template>
  <div>
    <p class="text-sm leading-6 text-[#4a5a54]">
      The
      <button
        type="button"
        class="inline appearance-none border-0 bg-transparent p-0 font-medium text-[#12201a] underline-offset-4 hover:underline"
        :class="termsError ? 'text-red-800 underline' : ''"
        @click="termsOpen = true"
      >Terms & Conditions</button>
      <span
        v-if="termsAccepted"
        class="ml-1 text-xs font-medium text-emerald-800"
      >(agreed)</span>
      govern the website and rental service. The
      <button
        type="button"
        class="inline appearance-none border-0 bg-transparent p-0 font-medium text-[#12201a] underline-offset-4 hover:underline"
        :class="privacyError ? 'text-red-800 underline' : ''"
        @click="privacyOpen = true"
      >Privacy Policy</button>
      <span
        v-if="privacyAcknowledged"
        class="ml-1 text-xs font-medium text-emerald-800"
      >(agreed)</span>
      explains how we process personal information. Marketing is optional.
    </p>
    <p
      v-if="termsError"
      class="mt-1.5 text-xs text-red-700"
    >
      {{ termsError }}
    </p>
    <p
      v-if="privacyError"
      class="mt-1.5 text-xs text-red-700"
    >
      {{ privacyError }}
    </p>

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
