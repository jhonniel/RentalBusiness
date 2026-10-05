<script setup lang="ts">
import type { PublicRental, PublicRentalIdentity } from '~/types/rental'
import { canUploadAdminIdentity } from '~/utils/identity'
import { identityUploadFormData } from '~/utils/browser-image'
import { IMAGE_UPLOAD_ACCEPT, IMAGE_UPLOAD_HELP } from '~/utils/image-upload'

const props = defineProps<{
  rental: PublicRental
  plain?: boolean
}>()

const emit = defineEmits<{
  uploaded: [identity: PublicRentalIdentity]
}>()

const toast = useToast()
const governmentFile = ref<File | null>(null)
const selfieFile = ref<File | null>(null)
const governmentInput = ref<HTMLInputElement | null>(null)
const selfieInput = ref<HTMLInputElement | null>(null)
const pending = ref(false)
const formError = ref('')

const canUpload = computed(() => canUploadAdminIdentity(props.rental))
const alreadySubmitted = computed(() => Boolean(props.rental.identity))

function onGovernmentChange(event: Event) {
  const input = event.target as HTMLInputElement
  governmentFile.value = input.files?.[0] ?? null
}

function onSelfieChange(event: Event) {
  const input = event.target as HTMLInputElement
  selfieFile.value = input.files?.[0] ?? null
}

async function onSubmit() {
  if (!canUpload.value) {
    return
  }

  formError.value = ''
  if (!governmentFile.value || !selfieFile.value) {
    formError.value = 'Upload a government ID and a selfie holding that same ID.'
    return
  }

  pending.value = true
  try {
    const identity = await $fetch<PublicRentalIdentity>(
      `/api/admin/rentals/${props.rental.uuid}/identity`,
      {
        method: 'POST',
        body: await identityUploadFormData({
          governmentId: governmentFile.value,
          selfie: selfieFile.value,
        }),
      },
    )
    toast.add({ title: 'Identity documents uploaded', color: 'success' })
    governmentFile.value = null
    selfieFile.value = null
    if (governmentInput.value) {
      governmentInput.value.value = ''
    }
    if (selfieInput.value) {
      selfieInput.value.value = ''
    }
    emit('uploaded', identity)
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not save those documents.'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <section :class="plain ? '' : 'rounded-xl border border-stone-200 bg-white p-5'">
    <h3
      v-if="!plain"
      class="text-sm font-medium text-stone-900"
    >
      Identity documents
    </h3>
    <p :class="plain ? 'text-sm text-stone-500' : 'mt-1 text-sm text-stone-500'">
      Upload the customer’s government ID and a selfie holding that ID. {{ IMAGE_UPLOAD_HELP }}
    </p>

    <p
      v-if="alreadySubmitted"
      class="mt-3 text-sm text-stone-600"
    >
      Documents are already on this rental. You can replace them before payment.
    </p>

    <AuthAlert
      v-if="formError"
      class="mt-4"
      :description="formError"
    />

    <div
      v-if="canUpload"
      class="mt-4 space-y-4"
    >
      <label class="block text-sm">
        <span class="mb-1.5 block text-stone-700">Government ID</span>
        <input
          ref="governmentInput"
          type="file"
          :accept="IMAGE_UPLOAD_ACCEPT"
          class="block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:text-stone-800"
          :disabled="pending"
          @change="onGovernmentChange"
        >
      </label>
      <label class="block text-sm">
        <span class="mb-1.5 block text-stone-700">Selfie with ID</span>
        <input
          ref="selfieInput"
          type="file"
          :accept="IMAGE_UPLOAD_ACCEPT"
          class="block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:text-stone-800"
          :disabled="pending"
          @change="onSelfieChange"
        >
      </label>
      <UButton
        type="button"
        :loading="pending"
        @click="onSubmit"
      >
        {{ alreadySubmitted ? 'Replace ID photos' : 'Save ID photos' }}
      </UButton>
    </div>

    <p
      v-else-if="!alreadySubmitted"
      class="mt-3 text-sm text-stone-600"
    >
      Identity documents can only be uploaded before payment starts.
    </p>
  </section>
</template>
