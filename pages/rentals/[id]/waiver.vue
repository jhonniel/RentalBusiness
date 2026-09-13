<script setup lang="ts">
import type { PublicRental } from '~/types/rental'
import type { PublicWaiverAcceptance, PublicWaiverVersion } from '~/types/waiver'
import { fieldErrors } from '~/utils/auth-validation'
import { formatBusinessDate } from '~/utils/datetime'
import { acceptWaiverSchema } from '~/utils/waiver-validation'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const { profile, authHeaders } = useAuth()
const toast = useToast()
const identifier = computed(() => String(route.params.id))
const pad = ref<{ toDataUrl: () => string, hasInk: { value: boolean } } | null>(null)
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
] as const
const accepted = reactive<Record<(typeof acknowledgments)[number]['id'], boolean>>({
  read: false,
  care: false,
  liability: false,
  laws: false,
  accurate: false,
  terms: false,
  privacy: false,
})
const allAcknowledged = computed(() => acknowledgments.every(item => accepted[item.id]))

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
  <section class="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
    <AccountNav />

    <h1 class="mt-8 text-2xl font-semibold tracking-tight break-words text-slate-900 sm:text-3xl">
      Equipment Rental Agreement & Liability Waiver
    </h1>
    <p class="mt-2 text-stone-600">
      Review the renter details from your account, read the current terms, confirm each acknowledgment, and sign. You will upload a government ID next.
    </p>

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
        Upload ID
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

      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 class="text-sm font-medium text-stone-900">
          Booking details
        </h2>
        <dl class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-stone-500">Renter</dt>
            <dd class="mt-0.5 text-stone-800">
              {{ accountName || [rental.customer?.firstName, rental.customer?.lastName].filter(Boolean).join(' ') || 'Your account name' }}
            </dd>
          </div>
          <div>
            <dt class="text-stone-500">Email</dt>
            <dd class="mt-0.5 text-stone-800">
              {{ accountEmail || 'From your account' }}
            </dd>
          </div>
          <div>
            <dt class="text-stone-500">Mobile</dt>
            <dd class="mt-0.5 text-stone-800">
              {{ accountPhone || rental.customer?.phone || 'Add a phone number on your profile' }}
            </dd>
          </div>
          <div>
            <dt class="text-stone-500">Booking ID</dt>
            <dd class="mt-0.5 text-stone-800">
              {{ rental.code }}
            </dd>
          </div>
          <div>
            <dt class="text-stone-500">Rental start</dt>
            <dd class="mt-0.5 text-stone-800">
              {{ formatBusinessDate(rental.startsOn) }}
            </dd>
          </div>
          <div>
            <dt class="text-stone-500">Rental return</dt>
            <dd class="mt-0.5 text-stone-800">
              {{ formatBusinessDate(rental.endsOn) }}
            </dd>
          </div>
        </dl>
        <ul class="mt-4 divide-y divide-stone-100 border-t border-stone-100 text-sm">
          <li
            v-for="item in rental.items"
            :key="item.uuid"
            class="flex justify-between gap-4 py-2"
          >
            <span class="text-stone-800">{{ item.product.name }}</span>
            <span class="text-stone-500">× {{ item.quantity }}</span>
          </li>
        </ul>
      </section>

      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <p class="text-xs uppercase tracking-wider text-lumen-700">
          Version {{ currentWaiver.version }}
        </p>
        <h2 class="mt-2 text-lg font-medium text-stone-900">
          {{ currentWaiver.title }}
        </h2>
        <div class="mt-4 max-h-[32rem] overflow-y-auto rounded-xl border border-stone-100 bg-stone-50 p-4">
          <p class="whitespace-pre-wrap text-sm leading-6 text-stone-700">
            {{ currentWaiver.body }}
          </p>
        </div>
      </section>

      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 class="text-sm font-medium text-stone-900">
          Renter acknowledgment
        </h2>
        <p class="mt-1 text-sm text-stone-500">
          Check every box to continue.
        </p>
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
          <span v-if="item.id === 'terms'">
            I have read and agree to the
            <NuxtLink
              to="/terms"
              target="_blank"
              class="font-medium text-[#12201a] underline-offset-4 hover:underline"
            >JRY Rentals Terms & Conditions</NuxtLink>.
          </span>
          <span v-else-if="item.id === 'privacy'">
            I acknowledge the
            <NuxtLink
              to="/privacy"
              target="_blank"
              class="font-medium text-[#12201a] underline-offset-4 hover:underline"
            >JRY Rentals Privacy Policy</NuxtLink>.
          </span>
          <span v-else>{{ item.label }}</span>
        </label>
      </section>

      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 class="text-sm font-medium text-stone-900">
          Digital signature
        </h2>
        <label class="mt-4 block text-sm">
          <span class="mb-1.5 block text-stone-700">Full name</span>
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

      <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <UButton
          type="submit"
          class="w-full sm:w-auto"
          :loading="pending"
          :disabled="!allAcknowledged"
        >
          I agree and sign
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
