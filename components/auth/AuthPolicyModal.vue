<script setup lang="ts">
import type { PublicPrivacyPolicy } from '~/types/privacy'
import type { PublicTerms } from '~/types/terms'
import { formatBusinessDate } from '~/utils/datetime'

const open = defineModel<boolean>('open', { required: true })

const props = withDefaults(defineProps<{
  document: PublicPrivacyPolicy | PublicTerms | null
  fallbackTitle: string
  loadError?: boolean
  pending?: boolean
  agreed?: boolean
  disabled?: boolean
  agreeLabel?: string
}>(), {
  agreeLabel: 'I agree',
})

const emit = defineEmits<{
  agree: []
}>()

const title = computed(() => props.document?.title || props.fallbackTitle)

function onAgree() {
  if (props.disabled || props.pending || props.loadError || !props.document) {
    return
  }

  emit('agree')
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :description="document
      ? `Version ${document.version} · Effective ${formatBusinessDate(document.effectiveDate)} · Last updated ${formatBusinessDate(document.lastUpdated)}`
      : 'Read this document, then agree to continue.'
    "
    :ui="{
      content: 'sm:max-w-2xl',
      body: 'max-h-[min(60vh,28rem)] overflow-y-auto',
    }"
  >
    <template #body>
      <p
        v-if="pending"
        class="text-sm leading-6 text-[#4a5a54]"
      >
        Loading document…
      </p>
      <p
        v-else-if="loadError || !document"
        class="text-sm leading-6 text-red-700"
      >
        This document is not available right now. Close the window and try again, or email jryrentals@gmail.com.
      </p>
      <div
        v-else
        class="whitespace-pre-wrap text-sm leading-7 text-[#3b4a44]"
      >
        {{ document.body }}
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="rounded-xl"
          @click="open = false"
        >
          Close
        </UButton>
        <UButton
          type="button"
          color="neutral"
          class="rounded-xl"
          :disabled="disabled || pending || loadError || !document"
          @click="onAgree"
        >
          {{ agreed ? 'Agreed' : agreeLabel }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
