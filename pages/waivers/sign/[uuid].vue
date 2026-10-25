<script setup lang="ts">
import type { PublicWaiverInvite } from '~/types/waiver-invite'
import type { AvailabilityCalendar } from '~/types/availability'
import type { PublicWaiverAcceptance } from '~/types/waiver'
import type { PublicRentalIdentity } from '~/types/rental'
import { fieldErrors } from '~/utils/auth-validation'
import { identityUploadFormData } from '~/utils/browser-image'
import { formatBusinessDate } from '~/utils/datetime'
import { renderWaiverBody } from '~/utils/waiver'
import { acceptWaiverInviteSchema, completeWaiverInviteContactSchema } from '~/utils/waiver-validation'
import { updateWaiverInviteScheduleSchema } from '~/utils/rental-validation'
import { defaultRentalReturnOn, formatPickupClock, formatRentalReturnLabel } from '~/utils/rental-window'

definePageMeta({
  layout: 'blank',
})

const route = useRoute()
const toast = useToast()
const uuid = computed(() => String(route.params.uuid || ''))
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '')
const pad = ref<{ toDataUrl: () => string, hasSignature: () => boolean } | null>(null)
const signerName = ref('')
const firstName = ref('')
const lastName = ref('')
const email = ref('')
const phone = ref('')
const contactReady = ref(false)
const startsOn = ref('')
const endsOn = ref('')
const pickupTime = ref('')
const scheduleReady = ref(false)
const dateCalendar = ref<AvailabilityCalendar | null>(null)
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
const showIdentityUpload = computed(() => Boolean(invite.value?.signed && invite.value.canUploadIdentity && !invite.value.identitySubmitted))
const needsIdentityBeforeSign = computed(() => Boolean(invite.value?.canSign && invite.value.canUploadIdentity && !invite.value.identitySubmitted))
const canSign = computed(() => Boolean(invite.value?.canSign && invite.value.waiver))
const pageTitle = computed(() => 'Equipment Rental Agreement')
const pageDescription = computed(() => {
  if (invite.value?.canSign) {
    return 'Change the dates if you need to. Fill in any missing name, email, or phone. Photograph your ID if it is not already on file, then sign. You do not need an account.'
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

const agreement = computed(() => {
  const lines = waiverBody.value.split('\n')
  const preamble: string[] = []
  const sections: { number: string, title: string, body: string }[] = []
  let current: { number: string, title: string, lines: string[] } | null = null

  for (const line of lines) {
    const heading = line.match(/^(\d+)\.\s+([A-Z][A-Z0-9 &'/,.-]+)$/)
    if (heading) {
      current = { number: heading[1], title: heading[2], lines: [] }
      sections.push({ number: current.number, title: current.title, body: '' })
      continue
    }
    if (current) {
      current.lines.push(line)
      sections[sections.length - 1].body = current.lines.join('\n').trim()
    }
    else if (!/^(JRY RENTALS|EQUIPMENT RENTAL AGREEMENT|Business:|Tagline:|Agreement version:)/.test(line.trim())) {
      preamble.push(line)
    }
  }

  return {
    preamble: preamble.join('\n').trim(),
    sections,
  }
})

const renterName = computed(() => {
  const name = [invite.value?.contact?.firstName, invite.value?.contact?.lastName].filter(Boolean).join(' ')
  return name || 'Customer'
})

watch(invite, (value) => {
  if (!value) {
    return
  }
  if (!scheduleReady.value) {
    endsOn.value = value.rental.endsOn
    startsOn.value = value.rental.startsOn
    pickupTime.value = value.rental.pickupTime || '09:00'
    scheduleReady.value = true
  }
  if (value.canEditSchedule && !dateCalendar.value) {
    void loadDateCalendar()
  }
  if (!contactReady.value) {
    firstName.value = value.contact?.firstName || ''
    lastName.value = value.contact?.lastName || ''
    email.value = value.contact?.email || ''
    phone.value = value.contact?.phone || ''
    contactReady.value = true
  }
  if (!signerName.value) {
    signerName.value = [firstName.value, lastName.value].filter(Boolean).join(' ')
  }
}, { immediate: true })

watch(startsOn, (value, previous) => {
  if (!scheduleReady.value || !value) {
    return
  }
  if (endsOn.value <= value || (previous && endsOn.value === defaultRentalReturnOn(previous))) {
    endsOn.value = defaultRentalReturnOn(value)
  }
})

async function loadDateCalendar() {
  if (!token.value) {
    return
  }
  try {
    dateCalendar.value = await $fetch<AvailabilityCalendar>(`/api/waivers/invites/${uuid.value}/calendar`, {
      query: { token: token.value },
    })
  }
  catch {
    dateCalendar.value = null
  }
}

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

  const schedule = invite.value.canEditSchedule
    ? updateWaiverInviteScheduleSchema.safeParse({
        token: token.value,
        startsOn: startsOn.value,
        endsOn: endsOn.value,
        pickupTime: pickupTime.value,
      })
    : null
  if (schedule && !schedule.success) {
    errors.value = fieldErrors(schedule.error)
    formError.value = schedule.error.issues[0]?.message || 'Choose a pickup and return date.'
    return
  }

  if (!signerName.value.trim()) {
    signerName.value = [firstName.value, lastName.value].filter(Boolean).join(' ')
  }

  const contact = completeWaiverInviteContactSchema.safeParse({
    token: token.value,
    firstName: firstName.value,
    lastName: lastName.value,
    email: email.value,
    phone: phone.value,
  })
  if (!contact.success) {
    errors.value = fieldErrors(contact.error)
    formError.value = contact.error.issues[0]?.message || 'Enter your name, email, and phone number.'
    return
  }

  if (needsIdentityBeforeSign.value && (!governmentFile.value || !selfieFile.value)) {
    formError.value = 'Photograph your government ID and a selfie holding that same ID.'
    return
  }

  if (!pad.value?.hasSignature()) {
    errors.value = { signatureData: 'Draw your signature on the pad.' }
    formError.value = 'Draw your signature on the pad.'
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
    if (schedule?.success) {
      await $fetch<PublicWaiverInvite>(`/api/waivers/invites/${uuid.value}/schedule`, {
        method: 'POST',
        body: schedule.data,
      })
    }
    await $fetch(`/api/waivers/invites/${uuid.value}/contact`, {
      method: 'POST',
      body: contact.data,
    })
    if (needsIdentityBeforeSign.value && governmentFile.value && selfieFile.value) {
      await $fetch<PublicRentalIdentity>(`/api/waivers/invites/${uuid.value}/identity`, {
        method: 'POST',
        body: await identityUploadFormData({
          governmentId: governmentFile.value,
          selfie: selfieFile.value,
          extra: { token: token.value },
        }),
      })
    }
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
    await refresh()
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
  <div class="waiver-page min-h-dvh max-w-full overflow-x-clip bg-[#f3f5f4] text-[#12201a]">
    <header class="border-b border-[#12201a]/10 bg-white">
      <div class="mx-auto flex w-full min-w-0 max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <AppLogo />
        <p class="max-w-[7.5rem] text-right text-[11px] font-medium leading-4 tracking-wide text-[#5b6b64] sm:max-w-none sm:text-xs">
          No account needed
        </p>
      </div>
    </header>

    <main class="mx-auto w-full min-w-0 max-w-3xl px-4 py-6 sm:px-6 sm:py-12">
      <p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#5b6b64] sm:tracking-[0.18em]">
        JRY Rentals
      </p>
      <h1 class="font-display mt-3 break-words text-[1.75rem] leading-tight text-[#12201a] [word-spacing:normal] sm:text-4xl">
        {{ pageTitle }}
      </h1>
      <p class="mt-3 max-w-2xl text-sm leading-7 text-[#4a5a54]">
        {{ pageDescription }}
      </p>

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
        description="Ask the shop to send a new waiver link."
      />

      <div
        v-else-if="invite"
        class="mt-8 space-y-5"
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

        <section class="min-w-0 overflow-hidden rounded-2xl border border-[#12201a]/10 bg-white shadow-sm">
          <div class="flex flex-col gap-2 border-b border-[#12201a]/8 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:px-6">
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#5b6b64]">
                Booking
              </p>
              <h2 class="mt-1 break-all text-lg font-medium text-[#12201a]">
                {{ invite.rental.code }}
              </h2>
            </div>
            <p class="text-sm text-[#4a5a54] sm:text-right">
              {{ renterName }}
            </p>
          </div>
          <dl class="grid gap-px bg-[#12201a]/8 sm:grid-cols-2">
            <div class="bg-white px-4 py-4 sm:px-6">
              <dt class="text-xs font-medium uppercase tracking-wide text-[#5b6b64]">
                Pickup
              </dt>
              <dd class="mt-1 text-sm text-[#12201a]">
                {{ formatBusinessDate(invite.canEditSchedule ? startsOn : invite.rental.startsOn) }}
                <span class="mt-0.5 block text-[#4a5a54]">
                  {{ formatPickupClock(invite.canEditSchedule ? pickupTime : invite.rental.pickupTime) }}
                </span>
              </dd>
            </div>
            <div class="bg-white px-4 py-4 sm:px-6">
              <dt class="text-xs font-medium uppercase tracking-wide text-[#5b6b64]">
                Return
              </dt>
              <dd class="mt-1 text-sm text-[#12201a]">
                {{ formatRentalReturnLabel(invite.canEditSchedule ? endsOn : invite.rental.endsOn, invite.canEditSchedule ? pickupTime : invite.rental.pickupTime) }}
              </dd>
            </div>
          </dl>
          <div
            v-if="invite.canEditSchedule"
            class="border-t border-[#12201a]/8 px-4 py-5 sm:px-6"
          >
            <p class="text-sm leading-6 text-[#4a5a54]">
              Change the dates if you need to. The equipment must still be free.
            </p>
            <div class="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
              <BookingDateField
                v-model="startsOn"
                label="Pickup date"
                :availability="dateCalendar"
                :until="endsOn || undefined"
                :disabled="pending"
              />
              <BookingPickupTime
                v-model="pickupTime"
                :availability="dateCalendar"
                :starts-on="startsOn"
                :ends-on="endsOn"
                :disabled="pending"
              />
              <BookingDateField
                v-model="endsOn"
                label="Return date"
                :availability="dateCalendar"
                :min="startsOn || undefined"
                :disabled="pending"
              />
            </div>
            <p
              v-if="errors.startsOn || errors.endsOn || errors.pickupTime"
              class="mt-3 text-xs text-red-700"
            >
              {{ errors.startsOn || errors.endsOn || errors.pickupTime }}
            </p>
          </div>
          <ul class="divide-y divide-[#12201a]/8 border-t border-[#12201a]/8">
            <li
              v-for="item in invite.rental.items"
              :key="item.uuid"
              class="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6"
            >
              <span class="min-w-0 font-medium break-words text-[#12201a]">{{ item.product.name }}</span>
              <span class="text-[#5b6b64]">Qty {{ item.quantity }}</span>
            </li>
          </ul>
          <div class="flex flex-col gap-3 border-t border-[#12201a]/8 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#5b6b64]">
                Payment
              </p>
              <p class="mt-1 break-words text-sm text-[#4a5a54]">
                The shop shares the payment details after your booking is reviewed.
              </p>
            </div>
            <span class="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700">
              <UIcon
                name="i-lucide-circle-dashed"
                class="size-3.5"
              />
              Not paid yet
            </span>
          </div>
        </section>

        <article
          v-if="invite.waiver"
          class="min-w-0 rounded-2xl border border-[#12201a]/10 bg-white px-4 py-5 shadow-sm sm:px-8 sm:py-8"
        >
          <header class="border-b border-[#12201a]/8 pb-5">
            <p class="break-all text-xs font-semibold uppercase tracking-[0.12em] text-lumen-700">
              {{ invite.waiver.version }}
            </p>
            <h2 class="font-display mt-2 break-words text-xl leading-tight text-[#12201a] [word-spacing:normal] sm:text-2xl">
              {{ invite.waiver.title }}
            </h2>
          </header>
          <WaiverAgreementText
            v-if="agreement.preamble"
            class="whitespace-pre-wrap pt-5 text-sm leading-7 text-[#3b4a44]"
            :text="agreement.preamble"
          />
          <WaiverAgreementText
            v-else-if="!agreement.sections.length"
            class="whitespace-pre-wrap pt-5 text-sm leading-7 text-[#3b4a44]"
            :text="waiverBody"
          />
          <section
            v-for="section in agreement.sections"
            :key="section.number"
            class="border-t border-[#12201a]/8 pt-5 mt-5 first:mt-0"
          >
            <h3 class="break-words text-xs font-semibold uppercase leading-5 tracking-wide text-[#12201a] [word-spacing:normal]">
              {{ section.number }}. {{ section.title }}
            </h3>
            <WaiverAgreementText
              class="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#3b4a44]"
              :text="section.body"
            />
          </section>
        </article>

        <form
          v-if="canSign"
          class="space-y-5"
          method="post"
          @submit.prevent="onSubmit"
        >
          <section class="min-w-0 rounded-2xl border border-[#12201a]/10 bg-white p-4 shadow-sm sm:p-6">
            <h2 class="text-base font-medium text-[#12201a]">
              Your details
            </h2>
            <p class="mt-1 text-sm leading-6 text-[#5b6b64]">
              Required before you sign. Details the shop already entered are filled in.
            </p>
            <div class="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
              <label class="block text-sm">
                <span class="mb-1.5 block text-[#3b4a44]">First name</span>
                <UInput
                  v-model="firstName"
                  class="w-full"
                  :disabled="pending"
                />
                <span
                  v-if="errors.firstName"
                  class="mt-1 block text-xs text-red-700"
                >{{ errors.firstName }}</span>
              </label>
              <label class="block text-sm">
                <span class="mb-1.5 block text-[#3b4a44]">Last name</span>
                <UInput
                  v-model="lastName"
                  class="w-full"
                  :disabled="pending"
                />
                <span
                  v-if="errors.lastName"
                  class="mt-1 block text-xs text-red-700"
                >{{ errors.lastName }}</span>
              </label>
              <label class="block text-sm">
                <span class="mb-1.5 block text-[#3b4a44]">Email</span>
                <UInput
                  v-model="email"
                  class="w-full"
                  type="email"
                  :disabled="pending || invite.contact?.emailLocked"
                />
                <span
                  v-if="errors.email"
                  class="mt-1 block text-xs text-red-700"
                >{{ errors.email }}</span>
              </label>
              <label class="block text-sm">
                <span class="mb-1.5 block text-[#3b4a44]">Phone number</span>
                <UInput
                  v-model="phone"
                  class="w-full"
                  type="tel"
                  :disabled="pending"
                />
                <span
                  v-if="errors.phone"
                  class="mt-1 block text-xs text-red-700"
                >{{ errors.phone }}</span>
              </label>
            </div>
          </section>

          <template v-if="needsIdentityBeforeSign">
            <section class="min-w-0 rounded-2xl border border-[#12201a]/10 bg-white p-4 shadow-sm sm:p-6">
              <h2 class="text-base font-medium text-[#12201a]">
                Government ID
              </h2>
              <p class="mt-1 text-sm leading-6 text-[#5b6b64]">
                Open the camera and photograph the front of a valid government-issued ID.
              </p>
              <CameraCapture
                v-model="governmentFile"
                facing="environment"
                :disabled="pending"
              />
            </section>

            <section class="min-w-0 rounded-2xl border border-[#12201a]/10 bg-white p-4 shadow-sm sm:p-6">
              <h2 class="text-base font-medium text-[#12201a]">
                Selfie with your ID
              </h2>
              <p class="mt-1 text-sm leading-6 text-[#5b6b64]">
                Open the front camera and hold the same ID next to your face. The name and photo on the ID should be readable.
              </p>
              <CameraCapture
                v-model="selfieFile"
                facing="user"
                :disabled="pending"
              />
            </section>
          </template>

          <section class="min-w-0 rounded-2xl border border-[#12201a]/10 bg-white p-4 shadow-sm sm:p-6">
            <h2 class="text-base font-medium text-[#12201a]">
              Acknowledgment
            </h2>
            <p class="mt-1 text-sm leading-6 text-[#5b6b64]">
              Confirm each statement before you sign.
            </p>
            <div class="mt-4 divide-y divide-[#12201a]/8">
              <label
                v-for="item in acknowledgments"
                :key="item.id"
                class="flex items-start gap-3 py-3 text-sm leading-6 text-[#3b4a44]"
              >
                <input
                  v-model="accepted[item.id]"
                  type="checkbox"
                  class="mt-1 size-4 shrink-0 accent-[#12201a]"
                  :disabled="pending"
                >
                <span class="min-w-0">{{ item.label }}</span>
              </label>
            </div>
          </section>

          <section class="min-w-0 rounded-2xl border border-[#12201a]/10 bg-white p-4 shadow-sm sm:p-6">
            <h2 class="text-base font-medium text-[#12201a]">
              Signature
            </h2>
            <p class="mt-1 text-sm leading-6 text-[#5b6b64]">
              Type your full name and sign in the box. This is your agreement to the terms above.
            </p>
            <label class="mt-5 block text-sm">
              <span class="mb-1.5 block text-[#3b4a44]">Full name</span>
              <UInput
                v-model="signerName"
                class="w-full"
                :disabled="pending"
              />
              <span
                v-if="errors.signerName"
                class="mt-1 block text-xs text-red-700"
              >{{ errors.signerName }}</span>
            </label>
            <div class="mt-4 max-w-full overflow-hidden">
              <span class="mb-1.5 block text-sm text-[#3b4a44]">Signature</span>
              <ClientOnly>
                <SignaturePad ref="pad" />
                <template #fallback>
                  <div class="h-40 rounded-xl border border-dashed border-[#12201a]/15 bg-[#f7f8f7]" />
                </template>
              </ClientOnly>
              <span
                v-if="errors.signatureData"
                class="mt-1 block text-xs text-red-700"
              >{{ errors.signatureData }}</span>
            </div>
          </section>

          <div class="rounded-2xl border border-[#12201a]/10 bg-white p-4 shadow-sm sm:p-6">
            <UButton
              type="submit"
              class="w-full justify-center"
              size="lg"
              :loading="pending"
              :disabled="!allAcknowledged"
            >
              I agree and sign
            </UButton>
            <p class="mt-3 text-center text-xs leading-5 text-[#5b6b64]">
              Signing records this agreement for {{ invite.rental.code }}.
            </p>
          </div>
        </form>

        <form
          v-if="showIdentityUpload"
          class="space-y-5"
          method="post"
          @submit.prevent="onUploadIdentity"
        >
          <section class="min-w-0 rounded-2xl border border-[#12201a]/10 bg-white p-4 shadow-sm sm:p-6">
            <h2 class="text-base font-medium text-[#12201a]">
              Government ID
            </h2>
            <p class="mt-1 text-sm leading-6 text-[#5b6b64]">
              Open the camera and photograph the front of a valid government-issued ID.
            </p>
            <CameraCapture
              v-model="governmentFile"
              facing="environment"
              :disabled="pending"
            />
          </section>

          <section class="min-w-0 rounded-2xl border border-[#12201a]/10 bg-white p-4 shadow-sm sm:p-6">
            <h2 class="text-base font-medium text-[#12201a]">
              Selfie with your ID
            </h2>
            <p class="mt-1 text-sm leading-6 text-[#5b6b64]">
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
            class="w-full justify-center"
            size="lg"
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
    </main>
  </div>
</template>

<style scoped>
.waiver-page :deep(p),
.waiver-page :deep(span),
.waiver-page :deep(h1),
.waiver-page :deep(h2),
.waiver-page :deep(h3),
.waiver-page :deep(li),
.waiver-page :deep(label),
.waiver-page :deep(a),
.waiver-page :deep(button) {
  word-spacing: normal;
}
</style>
