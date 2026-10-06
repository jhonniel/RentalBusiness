<script setup lang="ts">
import type { PublicWaiverInvite } from '~/types/waiver-invite'
import type { PublicWaiverAcceptance } from '~/types/waiver'
import type { PublicRentalIdentity } from '~/types/rental'
import { fieldErrors } from '~/utils/auth-validation'
import { identityUploadFormData } from '~/utils/browser-image'
import { formatBusinessDate } from '~/utils/datetime'
import { renderWaiverBody } from '~/utils/waiver'
import { acceptWaiverInviteSchema } from '~/utils/waiver-validation'

definePageMeta({
  layout: 'blank',
})

const route = useRoute()
const toast = useToast()
const uuid = computed(() => String(route.params.uuid || ''))
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '')
const pad = ref<{ toDataUrl: () => string, hasInk: { value: boolean } } | null>(null)
const signerName = ref('')
const errors = ref<Record<string, string>>({})
const formError = ref('')
const pending = ref(false)
const governmentFile = ref<File | null>(null)
const selfieFile = ref<File | null>(null)
const acknowledgments = [
  {
    id: 'read',
    label: 'I have read and understood the JRY Rentals Equipment Rental Agreement & Liability Waiver.',
  },
  {
    id: 'care',
    label: 'I agree to take reasonable care of the equipment and return it according to the rental terms.',
  },
  {
    id: 'liability',
    label: 'I understand that I may be financially responsible for loss, theft, or damage caused by my negligence, misuse, unauthorized use, or failure to properly care for the equipment.',
  },
  {
    id: 'laws',
    label: 'I agree to comply with applicable laws and safety requirements when using the equipment.',
  },
  {
    id: 'accurate',
    label: 'I confirm that the information I provided for this rental is accurate.',
  },
  {
    id: 'terms',
    label: 'I have read and agree to the JRY Rentals Terms & Conditions.',
  },
  {
    id: 'privacy',
    label: 'I acknowledge the JRY Rentals Privacy Policy.',
  },
  {
    id: 'downpayment',
    label: 'I understand that the down payment is not refundable once this rental is booked.',
  },
] as const
const accepted = reactive<Record<(typeof acknowledgments)[number]['id'], boolean>>({
  read: false,
  care: false,
  liability: false,
  laws: false,
  accurate: false,
  terms: false,
  privacy: false,
  downpayment: false,
})
const allAcknowledged = computed(() => acknowledgments.every(item => accepted[item.id]))

const { data: invite, error, refresh } = await useFetch<PublicWaiverInvite>(
  () => `/api/waivers/invites/${uuid.value}`,
  { query: { token } },
)

useSiteMeta({
  title: invite.value ? `Sign waiver · ${invite.value.rental.code}` : 'Sign waiver',
  path: `/waivers/sign/${uuid.value}`,
})

const unavailable = computed(() => error.value?.statusCode === 503)
const invalid = computed(() => Boolean(error.value) && error.value?.statusCode !== 503)
const showIdentityUpload = computed(() => Boolean(invite.value?.canUploadIdentity && !invite.value?.identitySubmitted))
const canSign = computed(() => Boolean(invite.value?.canSign && invite.value.waiver))
const pageTitle = computed(() => 'Equipment Rental Agreement')
const pageDescription = computed(() => {
  if (invite.value?.canSign) {
    return 'You do not need an account. Review the rental, check each box, and sign.'
  }
  if (invite.value?.signed && showIdentityUpload.value) {
    return 'This waiver is already signed. Photograph your government ID and a selfie holding that ID. You do not need an account.'
  }
  if (invite.value?.signed) {
    return 'This waiver is already signed. You do not need an account to review it.'
  }
  return 'You do not need an account. This link was sent by JRY Rentals.'
})
const waiverBody = computed(() =>
  invite.value?.waiver
    ? renderWaiverBody(invite.value.waiver.body, invite.value.rental.items)
    : '',
)

watch(invite, (value) => {
  if (!value || signerName.value) {
    return
  }
  signerName.value = [value.rental.customer?.firstName, value.rental.customer?.lastName].filter(Boolean).join(' ')
}, { immediate: true })

async function onSubmit() {
  formError.value = ''
  errors.value = {}

  if (!invite.value?.canSign || !invite.value.waiver) {
    formError.value = 'This waiver is already signed.'
    return
  }

  if (!allAcknowledged.value) {
    formError.value = 'Confirm every acknowledgment before you sign.'
    return
  }

  const parsed = acceptWaiverInviteSchema.safeParse({
    token: token.value,
    waiverVersionUuid: invite.value.waiver.uuid,
    signerName: signerName.value,
    signatureData: pad.value?.toDataUrl() || '',
  })

  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    formError.value = parsed.error.issues[0]?.message || 'Please complete the waiver.'
    return
  }

  pending.value = true
  try {
    await $fetch<PublicWaiverAcceptance>(`/api/waivers/invites/${uuid.value}/accept`, {
      method: 'POST',
      body: parsed.data,
    })
    toast.add({ title: 'Waiver signed', color: 'success' })
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not record that waiver.'
  }
  finally {
    pending.value = false
  }
}

async function onUploadIdentity() {
  formError.value = ''
  if (!governmentFile.value || !selfieFile.value) {
    formError.value = 'Photograph your government ID and a selfie holding that same ID.'
    return
  }

  pending.value = true
  try {
    await $fetch<PublicRentalIdentity>(`/api/waivers/invites/${uuid.value}/identity`, {
      method: 'POST',
      body: await identityUploadFormData({
        governmentId: governmentFile.value,
        selfie: selfieFile.value,
        extra: { token: token.value },
      }),
    })
    toast.add({ title: 'Identity documents saved', color: 'success' })
    governmentFile.value = null
    selfieFile.value = null
    await refresh()
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
  <div class="min-h-dvh bg-[#f4f6f4]">
    <header class="border-b border-[#12201a]/8 bg-white">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <AppLogo />
        <p class="text-xs text-stone-500">
          No account needed
        </p>
      </div>
    </header>

    <section class="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        JRY Rentals
      </p>
      <h1 class="mt-2 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
        {{ pageTitle }}
      </h1>
      <p class="mt-2 text-stone-600">
        {{ pageDescription }}
      </p>
    </div>

    <CatalogNotice
      v-if="unavailable"
      class="mt-8"
      title="Waivers are not connected"
      description="Add live Supabase credentials and apply the waiver-invite migration."
    />

    <CatalogNotice
      v-else-if="invalid"
      class="mt-8"
      title="This sign link is invalid"
      description="Ask the shop to send a new waiver link. Expired links cannot be opened again."
    />

    <div
      v-else-if="invite"
      class="mt-8 space-y-6"
    >
      <AuthAlert
        v-if="formError"
        :description="formError"
      />

      <CatalogNotice
        v-if="invite.signed"
        title="Waiver already signed"
        :description="`${invite.signerName || 'The customer'} already agreed and signed this rental waiver.`"
      />

      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 class="text-sm font-medium text-stone-900">
          Booking details
        </h2>
        <dl class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-stone-500">Renter</dt>
            <dd class="mt-0.5 text-stone-800">
              {{ [invite.rental.customer?.firstName, invite.rental.customer?.lastName].filter(Boolean).join(' ') || 'Renter' }}
            </dd>
          </div>
          <div>
            <dt class="text-stone-500">Booking ID</dt>
            <dd class="mt-0.5 text-stone-800">
              {{ invite.rental.code }}
            </dd>
          </div>
          <div>
            <dt class="text-stone-500">Rental start</dt>
            <dd class="mt-0.5 text-stone-800">
              {{ formatBusinessDate(invite.rental.startsOn) }}
            </dd>
          </div>
          <div>
            <dt class="text-stone-500">Rental return</dt>
            <dd class="mt-0.5 text-stone-800">
              {{ formatBusinessDate(invite.rental.endsOn) }}
            </dd>
          </div>
        </dl>
        <ul class="mt-4 divide-y divide-stone-100 border-t border-stone-100 text-sm">
          <li
            v-for="item in invite.rental.items"
            :key="item.uuid"
            class="flex justify-between gap-4 py-2"
          >
            <span class="text-stone-800">{{ item.product.name }}</span>
            <span class="text-stone-500">× {{ item.quantity }}</span>
          </li>
        </ul>
      </section>

      <section
        v-if="invite.waiver"
        class="rounded-2xl border border-stone-200 bg-white p-5"
      >
        <p class="text-xs uppercase tracking-wider text-lumen-700">
          Version {{ invite.waiver.version }}
        </p>
        <h2 class="mt-2 text-lg font-medium text-stone-900">
          {{ invite.waiver.title }}
        </h2>
        <div class="mt-4 max-h-[32rem] overflow-y-auto rounded-xl border border-stone-100 bg-stone-50 p-4">
          <p class="whitespace-pre-wrap text-sm leading-6 text-stone-700">
            {{ waiverBody }}
          </p>
        </div>
      </section>

      <form
        v-if="canSign"
        class="space-y-6"
        method="post"
        @submit.prevent="onSubmit"
      >
        <section class="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 class="text-sm font-medium text-stone-900">
            Renter acknowledgment
          </h2>
          <label
            v-for="item in acknowledgments"
            :key="item.id"
            class="mt-3 flex items-start gap-3 text-sm text-stone-700"
          >
            <input
              v-model="accepted[item.id]"
              type="checkbox"
              class="mt-1"
              :disabled="pending"
            >
            <span>{{ item.label }}</span>
          </label>
        </section>

        <section class="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 class="text-sm font-medium text-stone-900">
            Digital signature
          </h2>
          <label class="mt-4 block text-sm">
            <span class="mb-1.5 block text-sm text-stone-700">Full name</span>
            <UInput
              v-model="signerName"
              :disabled="pending"
            />
            <span
              v-if="errors.signerName"
              class="mt-1 block text-xs text-red-700"
            >{{ errors.signerName }}</span>
          </label>
          <div class="mt-4">
            <span class="mb-1.5 block text-sm text-stone-700">Signature</span>
            <ClientOnly>
              <SignaturePad ref="pad" />
              <template #fallback>
                <div class="h-40 rounded-xl border border-dashed border-stone-300 bg-stone-50" />
              </template>
            </ClientOnly>
            <span
              v-if="errors.signatureData"
              class="mt-1 block text-xs text-red-700"
            >{{ errors.signatureData }}</span>
          </div>
        </section>

        <UButton
          type="submit"
          class="w-full"
          :loading="pending"
          :disabled="!allAcknowledged"
        >
          I agree and sign
        </UButton>
      </form>

      <form
        v-if="showIdentityUpload"
        class="space-y-6"
        method="post"
        @submit.prevent="onUploadIdentity"
      >
        <section class="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 class="text-sm font-medium text-stone-900">
            Government ID
          </h2>
          <p class="mt-1 text-sm text-stone-500">
            Open the camera and photograph the front of a valid government-issued ID.
          </p>
          <CameraCapture
            v-model="governmentFile"
            facing="environment"
            :disabled="pending"
          />
        </section>

        <section class="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 class="text-sm font-medium text-stone-900">
            Selfie with your ID
          </h2>
          <p class="mt-1 text-sm text-stone-500">
            Open the front camera and hold the same ID next to your face. The name and photo on the ID should be readable.
          </p>
          <CameraCapture
            v-model="selfieFile"
            facing="user"
            :disabled="pending"
          />
        </section>

        <UButton
          type="submit"
          class="w-full"
          :loading="pending"
        >
          Save ID photos
        </UButton>
      </form>

      <CatalogNotice
        v-if="invite.identitySubmitted"
        title="Identity documents received"
        :description="`Government ID and selfie were received for ${invite.rental.code}.`"
      />
    </div>
    </section>
  </div>
</template>
