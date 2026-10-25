<script setup lang="ts">
import type { PublicRental, PublicRentalIdentity } from '~/types/rental'
import { identityUploadFormData } from '~/utils/browser-image'

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

const idTips = [
  'Use good light and avoid glare on the card.',
  'Fit the whole card in the frame.',
  'Name, photo, and ID number should be readable.',
]
const selfieTips = [
  'Face the camera without a cap or sunglasses.',
  'Hold the ID beside your face, not covering it.',
  'Use the same ID as in the first photo.',
]

const canUpload = computed(() => ['draft', 'pending'].includes(rental.value?.status ?? ''))
const alreadySubmitted = computed(() => Boolean(rental.value?.identity))

async function onSubmit() {
  if (!rental.value) {
    return
  }

  formError.value = ''
  if (!governmentFile.value || !selfieFile.value) {
    formError.value = 'Photograph your government ID and a selfie holding that same ID.'
    return
  }

  pending.value = true
  try {
    await $fetch<PublicRentalIdentity>(`/api/rentals/${rental.value.uuid}/identity`, {
      method: 'POST',
      headers: authHeaders(),
      body: await identityUploadFormData({
        governmentId: governmentFile.value,
        selfie: selfieFile.value,
      }),
    })
    toast.add({ title: 'Identity documents saved', color: 'success' })
    governmentFile.value = null
    selfieFile.value = null
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
  <section class="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
    <div class="flex flex-col gap-6 border-b border-[#12201a]/8 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6b64]">
          <template v-if="rental">
            {{ rental.code }}
          </template>
          <template v-else>
            Booking
          </template>
        </p>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight break-words text-[#12201a] sm:text-3xl">
          Identity verification
        </h1>
        <p class="mt-2 max-w-xl text-sm leading-6 text-[#5b6b64]">
          Take two quick photos so the shop can confirm who is renting the equipment.
        </p>
      </div>
      <BookingSteps
        :current="2"
        class="lg:min-w-[26rem]"
      />
    </div>

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
      description="Complete the rental waiver before photographing your ID."
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

      <div
        v-if="alreadySubmitted"
        class="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
      >
        <UIcon
          name="i-lucide-badge-check"
          class="mt-0.5 size-5 shrink-0 text-emerald-600"
        />
        <p>
          Your documents are already on file for this rental. Take new photos below only if one was unclear.
        </p>
      </div>

      <div class="flex items-start gap-3 rounded-2xl border border-[#12201a]/8 bg-[#f4f6f5] p-4 text-sm text-[#3b4a44]">
        <UIcon
          name="i-lucide-shield-check"
          class="mt-0.5 size-5 shrink-0 text-[#12201a]"
        />
        <p>
          <span class="font-medium text-[#12201a]">Your photos stay private.</span>
          Only the shop can view them, and they are used only to confirm this rental.
        </p>
      </div>

      <div class="grid gap-6 md:grid-cols-2">
        <section class="storefront-card min-w-0 rounded-2xl p-5 sm:p-6">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3">
              <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#12201a] text-xs font-semibold text-white">1</span>
              <div class="min-w-0">
                <h2 class="font-semibold text-[#12201a]">
                  Government ID
                </h2>
                <p class="mt-0.5 text-sm text-[#5b6b64]">
                  Front of a valid government-issued ID.
                </p>
              </div>
            </div>
            <UIcon
              v-if="governmentFile"
              name="i-lucide-circle-check"
              class="size-5 shrink-0 text-emerald-600"
            />
          </div>
          <ul class="mt-4 space-y-1.5 text-xs text-[#5b6b64]">
            <li
              v-for="tip in idTips"
              :key="tip"
              class="flex items-start gap-2"
            >
              <UIcon
                name="i-lucide-dot"
                class="size-4 shrink-0"
              />
              {{ tip }}
            </li>
          </ul>
          <CameraCapture
            v-model="governmentFile"
            facing="environment"
            :disabled="pending"
          />
        </section>

        <section class="storefront-card min-w-0 rounded-2xl p-5 sm:p-6">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3">
              <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#12201a] text-xs font-semibold text-white">2</span>
              <div class="min-w-0">
                <h2 class="font-semibold text-[#12201a]">
                  Selfie with your ID
                </h2>
                <p class="mt-0.5 text-sm text-[#5b6b64]">
                  Hold the same ID next to your face.
                </p>
              </div>
            </div>
            <UIcon
              v-if="selfieFile"
              name="i-lucide-circle-check"
              class="size-5 shrink-0 text-emerald-600"
            />
          </div>
          <ul class="mt-4 space-y-1.5 text-xs text-[#5b6b64]">
            <li
              v-for="tip in selfieTips"
              :key="tip"
              class="flex items-start gap-2"
            >
              <UIcon
                name="i-lucide-dot"
                class="size-4 shrink-0"
              />
              {{ tip }}
            </li>
          </ul>
          <CameraCapture
            v-model="selfieFile"
            facing="user"
            :disabled="pending"
          />
        </section>
      </div>

      <div class="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <UButton
            :to="`/rentals/${rental.code}`"
            color="neutral"
            variant="ghost"
            size="lg"
            icon="i-lucide-arrow-left"
            class="justify-center rounded-full sm:w-auto"
          >
            Back to rental
          </UButton>
          <UButton
            type="submit"
            size="lg"
            trailing-icon="i-lucide-arrow-right"
            class="w-full justify-center rounded-full sm:w-auto sm:min-w-56"
            :loading="pending"
            :disabled="!governmentFile || !selfieFile"
          >
            {{ alreadySubmitted ? 'Replace and continue' : 'Submit and continue' }}
          </UButton>
        </div>
        <p class="mt-3 text-center text-xs leading-5 text-stone-500 sm:text-right">
          <template v-if="governmentFile && selfieFile">
            Both photos are ready. Next you will review your request.
          </template>
          <template v-else>
            Take both photos to continue · {{ (governmentFile ? 1 : 0) + (selfieFile ? 1 : 0) }} of 2 done
          </template>
        </p>
      </div>
    </form>
  </section>
</template>
