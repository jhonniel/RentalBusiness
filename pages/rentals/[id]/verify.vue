<script setup lang="ts">
import type { PublicRental, PublicRentalIdentity } from '~/types/rental'

definePageMeta({
  layout: 'account',
  middleware: 'auth',
})

const route = useRoute()
const toast = useToast()
const { authHeaders } = useAuth()
const identifier = computed(() => String(route.params.id))
const governmentFile = ref<File | null>(null)
const selfieFile = ref<File | null>(null)
const governmentInput = ref<HTMLInputElement | null>(null)
const selfieInput = ref<HTMLInputElement | null>(null)
const pending = ref(false)
const formError = ref('')

const { data: rental, error, refresh } = await useFetch<PublicRental>(
  () => `/api/rentals/${identifier.value}`,
)

if (error.value?.statusCode === 404) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Rental not found',
  })
}

useSiteMeta({
  title: rental.value ? `Verify · ${rental.value.code}` : 'Verify identity',
  path: `/rentals/${identifier.value}/verify`,
})

const canUpload = computed(() => ['draft', 'pending'].includes(rental.value?.status ?? ''))
const alreadySubmitted = computed(() => Boolean(rental.value?.identity))

function onGovernmentChange(event: Event) {
  const input = event.target as HTMLInputElement
  governmentFile.value = input.files?.[0] ?? null
}

function onSelfieChange(event: Event) {
  const input = event.target as HTMLInputElement
  selfieFile.value = input.files?.[0] ?? null
}

async function onSubmit() {
  if (!rental.value) {
    return
  }

  formError.value = ''
  if (!governmentFile.value || !selfieFile.value) {
    formError.value = 'Upload a government ID and a selfie holding that same ID.'
    return
  }

  const body = new FormData()
  body.append('governmentId', governmentFile.value)
  body.append('selfie', selfieFile.value)

  pending.value = true
  try {
    await $fetch<PublicRentalIdentity>(`/api/rentals/${rental.value.uuid}/identity`, {
      method: 'POST',
      headers: authHeaders(),
      body,
    })
    toast.add({ title: 'Identity documents uploaded', color: 'success' })
    governmentFile.value = null
    selfieFile.value = null
    if (governmentInput.value) {
      governmentInput.value.value = ''
    }
    if (selfieInput.value) {
      selfieInput.value.value = ''
    }
    await refresh()
    await navigateTo(`/rentals/${rental.value.code}/pay`)
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
  <section class="mx-auto max-w-3xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
    <h1 class="text-2xl font-semibold tracking-tight break-words text-slate-900 sm:text-3xl">
      Identity verification
    </h1>
    <p class="mt-2 text-stone-600">
      Upload a clear photo of your government ID and a selfie holding that same ID. These files stay private and are used only to confirm this rental.
    </p>

    <CatalogNotice
      v-if="error?.statusCode === 503"
      class="mt-8"
      title="Verification is not connected"
      description="Add live Supabase credentials and apply the Phase 17 migration to upload identity documents."
    />

    <CatalogNotice
      v-else-if="rental && !rental.waiver"
      class="mt-8"
      title="Sign the waiver first"
      description="Complete the rental waiver before uploading identity documents."
    >
      <UButton :to="`/rentals/${rental.code}/waiver`">
        Sign waiver
      </UButton>
    </CatalogNotice>

    <CatalogNotice
      v-else-if="rental && !canUpload"
      class="mt-8"
      title="This rental cannot accept new documents"
      description="Identity documents can only be uploaded before payment starts."
    >
      <UButton :to="`/rentals/${rental.code}`">
        Back to rental
      </UButton>
    </CatalogNotice>

    <form
      v-else-if="rental"
      class="mt-8 space-y-6"
      method="post"
      @submit.prevent="onSubmit"
    >
      <AuthAlert
        v-if="formError"
        :description="formError"
      />

      <section
        v-if="alreadySubmitted"
        class="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600"
      >
        Documents were submitted
        {{ rental.identity ? `on this rental.` : '.' }}
        You can replace them before payment if a photo is unclear.
      </section>

      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 class="text-sm font-medium text-stone-900">
          Government ID
        </h2>
        <p class="mt-1 text-sm text-stone-500">
          Front of a valid government-issued ID. JPG, PNG, or WebP, up to 5 MB.
        </p>
        <input
          ref="governmentInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="mt-4 block w-full text-sm"
          :disabled="pending"
          @change="onGovernmentChange"
        >
      </section>

      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 class="text-sm font-medium text-stone-900">
          Selfie with your ID
        </h2>
        <p class="mt-1 text-sm text-stone-500">
          Hold the same ID next to your face. The name and photo on the ID should be readable.
        </p>
        <input
          ref="selfieInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="mt-4 block w-full text-sm"
          :disabled="pending"
          @change="onSelfieChange"
        >
      </section>

      <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <UButton
          type="submit"
          class="w-full sm:w-auto"
          :loading="pending"
        >
          {{ alreadySubmitted ? 'Replace and continue' : 'Submit and continue' }}
        </UButton>
        <UButton
          :to="`/rentals/${rental.code}`"
          color="neutral"
          variant="outline"
          class="w-full sm:w-auto"
        >
          Back
        </UButton>
      </div>
    </form>
  </section>
</template>
