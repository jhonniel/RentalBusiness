<script setup lang="ts">
import type { PublicRental } from '~/types/rental'
import type { PublicWaiverAcceptance, PublicWaiverVersion } from '~/types/waiver'
import { fieldErrors } from '~/utils/auth-validation'
import { formatBusinessDate } from '~/utils/datetime'
import { renderWaiverBody } from '~/utils/waiver'
import { acceptWaiverSchema } from '~/utils/waiver-validation'

definePageMeta({
  layout: 'account',
  middleware: 'auth',
})

const route = useRoute()
const { profile, authHeaders } = useAuth()
const toast = useToast()
const identifier = computed(() => String(route.params.id))
const pad = ref<{ toDataUrl: () => string, hasSignature: () => boolean } | null>(null)
const signerName = ref('')
const errors = ref<Record<string, string>>({})
const formError = ref('')
const pending = ref(false)
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
const acknowledgedCount = computed(() => acknowledgments.filter(item => accepted[item.id]).length)

const accountName = computed(() => [profile.value?.firstName, profile.value?.lastName].filter(Boolean).join(' '))
const accountEmail = computed(() => profile.value?.email || '')
const accountPhone = computed(() => profile.value?.phone || '')

watch(profile, (value) => {
  if (!value || signerName.value) {
    return
  }
  signerName.value = [value.firstName, value.lastName].filter(Boolean).join(' ')
}, { immediate: true })

const { data: rental, error: rentalError } = await useFetch<PublicRental>(
  () => `/api/rentals/${identifier.value}`,
)

const { data: currentWaiver, error: waiverError } = await useFetch<PublicWaiverVersion>(
  '/api/waivers/current',
)

if (rentalError.value?.statusCode === 404) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Rental not found',
  })
}

useSiteMeta({
  title: rental.value ? `Waiver · ${rental.value.code}` : 'Waiver',
  path: `/rentals/${identifier.value}/waiver`,
})

const unavailable = computed(() =>
  rentalError.value?.statusCode === 503 || waiverError.value?.statusCode === 503,
)

const alreadySigned = computed(() => Boolean(rental.value?.waiver))
const canSign = computed(() => ['draft', 'pending'].includes(rental.value?.status ?? '') && !alreadySigned.value)
const waiverBody = computed(() =>
  currentWaiver.value
    ? renderWaiverBody(currentWaiver.value.body, rental.value?.items ?? [])
    : '',
)

async function onSubmit() {
  formError.value = ''
  errors.value = {}

  if (!rental.value || !currentWaiver.value) {
    formError.value = 'The waiver is not available yet.'
    return
  }

  if (!allAcknowledged.value) {
    formError.value = 'Confirm every acknowledgment before you sign.'
    return
  }

  if (!pad.value?.hasSignature()) {
    errors.value = { signatureData: 'Draw your signature on the pad.' }
    formError.value = 'Draw your signature on the pad.'
    return
  }

  const parsed = acceptWaiverSchema.safeParse({
    rentalUuid: rental.value.uuid,
    rentalCode: rental.value.code,
    waiverVersionUuid: currentWaiver.value.uuid,
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
    await $fetch<PublicWaiverAcceptance>('/api/waivers/accept', {
      method: 'POST',
      headers: authHeaders(),
      body: parsed.data,
    })
    toast.add({ title: 'Waiver signed', color: 'success' })
    await navigateTo(`/rentals/${rental.value.code}/verify`)
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
</script>

<template>
  <section class="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
    <div class="flex flex-col gap-6 border-b border-[#12201a]/8 pb-6">
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
          Equipment Rental Agreement & Liability Waiver
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-[#5b6b64]">
          Check your booking details, read the agreement, confirm each acknowledgment, and sign. You will photograph a government ID next.
        </p>
      </div>
      <BookingSteps
        :current="1"
      />
    </div>

    <CatalogNotice
      v-if="unavailable"
      class="mt-8"
      title="Waivers are not connected"
      description="Add live Supabase credentials and apply the Phase 7 migration to sign a waiver."
    />

    <CatalogNotice
      v-else-if="alreadySigned && rental?.waiver"
      class="mt-8"
      title="Waiver already signed"
      :description="`You accepted version ${rental.waiver.version.version} on this rental.`"
    >
      <UButton
        v-if="!rental.identity"
        :to="`/rentals/${rental.code}/verify`"
      >
        Take ID photos
      </UButton>
      <UButton
        v-else
        :to="`/rentals/${rental.code}`"
      >
        Back to rental
      </UButton>
    </CatalogNotice>

    <CatalogNotice
      v-else-if="rental && !canSign"
      class="mt-8"
      title="This rental cannot be signed"
      description="Cancelled or closed requests cannot accept a waiver."
    >
      <UButton :to="`/rentals/${rental.code}`">
        Back to rental
      </UButton>
    </CatalogNotice>

    <form
      v-else-if="rental && currentWaiver"
      class="mt-8 space-y-6"
      method="post"
      @submit.prevent="onSubmit"
    >
      <AuthAlert
        v-if="formError"
        :description="formError"
      />

      <section class="storefront-card rounded-2xl p-5 sm:p-6">
        <div class="flex items-start gap-3">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#12201a] text-xs font-semibold text-white">1</span>
          <div class="min-w-0">
            <h2 class="font-semibold text-[#12201a]">
              Booking details
            </h2>
            <p class="mt-0.5 text-sm text-[#5b6b64]">
              From your account and this booking. Update your profile if anything is wrong.
            </p>
          </div>
        </div>
        <dl class="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
          <div class="min-w-0">
            <dt class="text-xs text-[#5b6b64]">
              Renter
            </dt>
            <dd class="mt-0.5 font-medium break-words text-[#12201a]">
              {{ accountName || [rental.customer?.firstName, rental.customer?.lastName].filter(Boolean).join(' ') || 'Your account name' }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-xs text-[#5b6b64]">
              Email
            </dt>
            <dd class="mt-0.5 font-medium break-words text-[#12201a]">
              {{ accountEmail || 'From your account' }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-xs text-[#5b6b64]">
              Mobile
            </dt>
            <dd class="mt-0.5 font-medium break-words text-[#12201a]">
              {{ accountPhone || rental.customer?.phone || 'Add a phone number on your profile' }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-xs text-[#5b6b64]">
              Booking ID
            </dt>
            <dd class="mt-0.5 font-medium text-[#12201a]">
              {{ rental.code }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-xs text-[#5b6b64]">
              Rental start
            </dt>
            <dd class="mt-0.5 font-medium text-[#12201a]">
              {{ formatBusinessDate(rental.startsOn) }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-xs text-[#5b6b64]">
              Rental return
            </dt>
            <dd class="mt-0.5 font-medium text-[#12201a]">
              {{ formatBusinessDate(rental.endsOn) }}
            </dd>
          </div>
        </dl>
        <ul class="mt-5 space-y-2">
          <li
            v-for="item in rental.items"
            :key="item.uuid"
            class="flex items-center justify-between gap-4 rounded-xl bg-[#f4f6f5] px-3.5 py-2.5 text-sm"
          >
            <span class="flex min-w-0 items-center gap-2 text-[#12201a]">
              <UIcon
                name="i-lucide-package"
                class="size-4 shrink-0 text-[#5b6b64]"
              />
              <span class="truncate font-medium">{{ item.product.name }}</span>
            </span>
            <span class="shrink-0 text-[#5b6b64]">Qty {{ item.quantity }}</span>
          </li>
        </ul>
      </section>

      <section class="storefront-card overflow-hidden rounded-2xl">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-[#12201a]/8 p-5 sm:p-6">
          <div class="flex min-w-0 items-start gap-3">
            <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#12201a] text-xs font-semibold text-white">2</span>
            <div class="min-w-0">
              <h2 class="font-semibold text-[#12201a]">
                {{ currentWaiver.title }}
              </h2>
              <p class="mt-0.5 text-sm text-[#5b6b64]">
                Read the full agreement before you sign. Scroll inside the box to see every section.
              </p>
            </div>
          </div>
          <span class="inline-flex items-center gap-1 rounded-full border border-[#12201a]/10 px-2.5 py-1 text-xs font-medium text-[#3b4a44]">
            <UIcon
              name="i-lucide-file-text"
              class="size-3.5"
            />
            Version {{ currentWaiver.version }}
          </span>
        </div>
        <div class="relative">
          <div class="max-h-[30rem] overflow-y-auto bg-[#fbfcfb] px-5 py-6 sm:px-10 sm:py-8">
            <WaiverAgreementText
              class="mx-auto max-w-2xl whitespace-pre-wrap font-serif text-[15px] leading-7 text-[#26332e]"
              :text="waiverBody"
            />
          </div>
          <div class="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#fbfcfb] to-transparent" />
        </div>
      </section>

      <section class="storefront-card rounded-2xl p-5 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex min-w-0 items-start gap-3">
            <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#12201a] text-xs font-semibold text-white">3</span>
            <div class="min-w-0">
              <h2 class="font-semibold text-[#12201a]">
                Renter acknowledgment
              </h2>
              <p class="mt-0.5 text-sm text-[#5b6b64]">
                Confirm each statement to continue.
              </p>
            </div>
          </div>
          <span
            class="rounded-full px-2.5 py-1 text-xs font-medium tabular-nums"
            :class="allAcknowledged ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f4f6f5] text-[#3b4a44]'"
          >
            {{ acknowledgedCount }} of {{ acknowledgments.length }} confirmed
          </span>
        </div>
        <div class="mt-5 space-y-2">
          <label
            v-for="item in acknowledgments"
            :key="item.id"
            class="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6 transition-colors"
            :class="accepted[item.id]
              ? 'border-[#12201a]/25 bg-[#f4f6f5] text-[#12201a]'
              : 'border-[#12201a]/10 text-[#3b4a44] hover:border-[#12201a]/25'"
          >
            <input
              v-model="accepted[item.id]"
              type="checkbox"
              class="mt-1 size-4 shrink-0 accent-[#12201a]"
              :disabled="pending"
            >
            <span v-if="item.id === 'terms'">
              I have read and agree to the
              <NuxtLink
                to="/terms"
                target="_blank"
                class="font-medium text-[#12201a] underline underline-offset-4"
              >JRY Rentals Terms & Conditions</NuxtLink>.
            </span>
            <span v-else-if="item.id === 'privacy'">
              I acknowledge the
              <NuxtLink
                to="/privacy"
                target="_blank"
                class="font-medium text-[#12201a] underline underline-offset-4"
              >JRY Rentals Privacy Policy</NuxtLink>.
            </span>
            <span v-else>{{ item.label }}</span>
          </label>
        </div>
      </section>

      <section class="storefront-card rounded-2xl p-5 sm:p-6">
        <div class="flex items-start gap-3">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#12201a] text-xs font-semibold text-white">4</span>
          <div class="min-w-0">
            <h2 class="font-semibold text-[#12201a]">
              Digital signature
            </h2>
            <p class="mt-0.5 text-sm text-[#5b6b64]">
              Type your full legal name and sign inside the box with your finger or mouse.
            </p>
          </div>
        </div>
        <label class="mt-5 block text-sm sm:max-w-md">
          <span class="mb-1.5 block text-xs font-medium text-[#5b6b64]">Full name</span>
          <UInput
            v-model="signerName"
            size="lg"
            class="w-full"
            autocomplete="name"
            :disabled="pending"
          />
          <span
            v-if="errors.signerName"
            class="mt-1 block text-xs text-red-700"
          >{{ errors.signerName }}</span>
        </label>
        <div class="mt-5">
          <span class="mb-1.5 block text-xs font-medium text-[#5b6b64]">Signature</span>
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
        <p class="mt-4 flex items-start gap-2 text-xs leading-5 text-[#5b6b64]">
          <UIcon
            name="i-lucide-shield-check"
            class="mt-0.5 size-4 shrink-0"
          />
          Your signature, name, and the time you sign are saved with this agreement as your record for {{ rental.code }}.
        </p>
      </section>

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
            trailing-icon="i-lucide-pen-line"
            class="w-full justify-center rounded-full sm:w-auto sm:min-w-56"
            :loading="pending"
            :disabled="!allAcknowledged"
          >
            I agree and sign
          </UButton>
        </div>
        <p class="mt-3 text-center text-xs leading-5 text-stone-500 sm:text-right">
          <template v-if="allAcknowledged">
            Signing records this agreement for {{ rental.code }}.
          </template>
          <template v-else>
            Confirm all {{ acknowledgments.length }} statements above to sign · {{ acknowledgedCount }} done
          </template>
        </p>
      </div>
    </form>
  </section>
</template>
