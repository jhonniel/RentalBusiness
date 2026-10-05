<script setup lang="ts">
import type { PublicRental } from '~/types/rental'
import type { PublicWaiverAcceptance, PublicWaiverVersion } from '~/types/waiver'
import type { WaiverInviteSendResult } from '~/types/waiver-invite'
import { fieldErrors } from '~/utils/auth-validation'
import { formatBusinessDateTime } from '~/utils/datetime'
import { renderWaiverBody } from '~/utils/waiver'
import { canResetAdminWaiver, canSendGuestRentalLink, canSendWaiverInvite } from '~/utils/waiver-invite'
import { acceptAdminWaiverSchema } from '~/utils/waiver-validation'

const props = defineProps<{
  rental: PublicRental
  disabled?: boolean
}>()

const emit = defineEmits<{
  signed: []
  reset: []
}>()

const toast = useToast()
const email = ref('')
const waiverUrl = ref('')
const sending = ref(false)
const copied = ref(false)
const signing = ref(false)
const resetOpen = ref(false)
const resetting = ref(false)
const linkInput = ref<HTMLInputElement | null>(null)
const formError = ref('')
const errors = ref<Record<string, string>>({})
const pad = ref<{ toDataUrl: () => string, hasInk: { value: boolean } } | null>(null)
const signerName = ref('')
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
const canInvite = computed(() => canSendWaiverInvite(props.rental))
const canGuestLink = computed(() => canSendGuestRentalLink(props.rental))
const canReset = computed(() => canResetAdminWaiver(props.rental))

const { data: currentWaiver } = await useFetch<PublicWaiverVersion>('/api/waivers/current')
const waiverBody = computed(() => (
  currentWaiver.value
    ? renderWaiverBody(currentWaiver.value.body, props.rental.items)
    : ''
))

watch(() => props.rental.customer, (customer) => {
  if (signerName.value || !customer) {
    return
  }
  signerName.value = [customer.firstName, customer.lastName].filter(Boolean).join(' ')
}, { immediate: true })

async function createLink(options: { copy?: boolean, notify?: boolean } = {}) {
  if (!canGuestLink.value) {
    return
  }

  formError.value = ''
  copied.value = false
  sending.value = true
  try {
    const result = await $fetch<WaiverInviteSendResult>(
      `/api/admin/rentals/${props.rental.uuid}/waiver-invite`,
      {
        method: 'POST',
        body: { email: email.value || undefined },
      },
    )
    waiverUrl.value = result.waiverUrl
    if (options.copy !== false) {
      await copyLink(false)
    }
    if (options.notify !== false) {
      toast.add({
        title: result.sent ? 'Link copied and emailed' : 'Waiver link copied',
        color: 'success',
      })
    }
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not create that waiver link.'
  }
  finally {
    sending.value = false
  }
}

async function copyLink(showToast = true) {
  if (!waiverUrl.value) {
    return
  }

  try {
    if (import.meta.client && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(waiverUrl.value)
    }
    else {
      linkInput.value?.select()
      document.execCommand('copy')
    }
    copied.value = true
    if (showToast) {
      toast.add({ title: 'Waiver link copied', color: 'success' })
    }
  }
  catch {
    linkInput.value?.select()
    formError.value = 'Copy the link from the box, then send it to the customer.'
  }
}

function openSignPage() {
  if (!waiverUrl.value || !import.meta.client) {
    return
  }
  window.open(waiverUrl.value, '_blank', 'noopener,noreferrer')
}

async function onSign() {
  formError.value = ''
  errors.value = {}

  if (!canInvite.value || !currentWaiver.value) {
    formError.value = 'A sign link can only be used before the customer signs.'
    return
  }

  if (!allAcknowledged.value) {
    formError.value = 'Confirm every acknowledgment before you sign.'
    return
  }

  const parsed = acceptAdminWaiverSchema.safeParse({
    waiverVersionUuid: currentWaiver.value.uuid,
    signerName: signerName.value,
    signatureData: pad.value?.toDataUrl() || '',
  })
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    formError.value = parsed.error.issues[0]?.message || 'Please complete the waiver.'
    return
  }

  signing.value = true
  try {
    await $fetch<PublicWaiverAcceptance>(`/api/admin/rentals/${props.rental.uuid}/waiver`, {
      method: 'POST',
      body: parsed.data,
    })
    toast.add({ title: 'Waiver signed', color: 'success' })
    emit('signed')
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not record that waiver.'
  }
  finally {
    signing.value = false
  }
}

async function onReset() {
  formError.value = ''
  resetting.value = true
  try {
    await $fetch(`/api/admin/rentals/${props.rental.uuid}/waiver`, { method: 'DELETE' })
    toast.add({ title: 'Waiver set to unsigned', color: 'success' })
    resetOpen.value = false
    emit('reset')
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not change that waiver status.'
  }
  finally {
    resetting.value = false
  }
}

watch(canGuestLink, (value) => {
  if (value && !waiverUrl.value) {
    void createLink({ copy: false, notify: false })
  }
}, { immediate: true })
</script>

<template>
  <section class="rounded-xl border border-stone-200 bg-white p-5">
    <h3 class="text-sm font-medium text-stone-900">
      {{ rental.waiver ? 'Waiver' : 'Agree and sign' }}
    </h3>
    <p class="mt-1 text-sm text-stone-500">
      {{ rental.waiver
        ? 'This waiver is signed. Change the status to unsigned if the customer needs to agree and sign again. Copy the customer link below to send it without an account.'
        : 'Copy this link and send it in Messenger, SMS, or email. The customer can open it without an account, agree to the terms, and sign.' }}
    </p>

    <AuthAlert
      v-if="formError"
      class="mt-4"
      :description="formError"
    />

    <div
      v-if="rental.waiver"
      class="mt-4 space-y-3"
    >
      <p class="text-sm text-stone-800">
        Signed by {{ rental.waiver.signerName }} on {{ formatBusinessDateTime(rental.waiver.acceptedAt) }}.
      </p>
      <p class="text-sm text-stone-600">
        Status: Accepted
      </p>
      <AdminSignedWaiverLink :rental-uuid="rental.uuid" />
      <div
        v-if="canReset"
        class="flex flex-wrap items-center gap-2"
      >
        <template v-if="!resetOpen">
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            :disabled="disabled || resetting"
            @click="resetOpen = true"
          >
            Change status to unsigned
          </UButton>
        </template>
        <template v-else>
          <p class="text-sm text-stone-700">
            Remove this signature so they can agree and sign again?
          </p>
          <UButton
            type="button"
            color="error"
            :loading="resetting"
            @click="onReset"
          >
            Confirm unsigned
          </UButton>
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            :disabled="resetting"
            @click="resetOpen = false"
          >
            Cancel
          </UButton>
        </template>
      </div>
    </div>

    <div
      v-if="canGuestLink"
      class="mt-4 space-y-6"
    >
      <div class="space-y-3">
        <p class="text-sm font-medium text-stone-800">
          {{ rental.waiver ? 'Customer link' : 'Customer sign link' }}
        </p>
        <p class="text-sm text-stone-500">
          They do not need to log in.
        </p>
        <div class="flex flex-col gap-2 sm:flex-row">
          <input
            ref="linkInput"
            :value="waiverUrl"
            readonly
            :placeholder="sending ? 'Creating link…' : 'Creating a sign link…'"
            class="h-11 w-full rounded-md border border-stone-200 bg-stone-50 px-3 text-xs text-stone-800"
            @focus="($event.target as HTMLInputElement).select()"
          >
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            class="shrink-0"
            :disabled="!waiverUrl"
            @click="copyLink()"
          >
            {{ copied ? 'Copied' : 'Copy link' }}
          </UButton>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            type="button"
            :disabled="!waiverUrl"
            @click="openSignPage"
          >
            Open sign page
          </UButton>
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            :loading="sending"
            :disabled="disabled"
            @click="createLink"
          >
            Create a new link
          </UButton>
        </div>
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Email (optional)</span>
          <UInput
            v-model="email"
            type="email"
            placeholder="Fill this only if you also want the link emailed"
            :disabled="disabled || sending"
          />
        </label>
      </div>

      <div
        v-if="canInvite && currentWaiver"
        class="space-y-4 border-t border-stone-100 pt-5"
      >
        <p class="text-sm font-medium text-stone-800">
          Sign here
        </p>
        <p class="text-xs uppercase tracking-wider text-lumen-700">
          Version {{ currentWaiver.version }}
        </p>
        <h4 class="text-base font-medium text-stone-900">
          {{ currentWaiver.title }}
        </h4>
        <div class="max-h-80 overflow-y-auto rounded-xl border border-stone-100 bg-stone-50 p-4">
          <p class="whitespace-pre-wrap text-sm leading-6 text-stone-700">
            {{ waiverBody }}
          </p>
        </div>

        <label
          v-for="item in acknowledgments"
          :key="item.id"
          class="flex items-start gap-3 text-sm text-stone-700"
        >
          <input
            v-model="accepted[item.id]"
            type="checkbox"
            class="mt-1"
            :disabled="disabled || signing"
          >
          <span>{{ item.label }}</span>
        </label>

        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Full name</span>
          <UInput
            v-model="signerName"
            :disabled="disabled || signing"
          />
          <span
            v-if="errors.signerName"
            class="mt-1 block text-xs text-red-700"
          >{{ errors.signerName }}</span>
        </label>

        <div>
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

        <UButton
          type="button"
          :loading="signing"
          :disabled="disabled || !allAcknowledged"
          @click="onSign"
        >
          I agree and sign
        </UButton>
      </div>
    </div>

    <p
      v-else-if="!rental.waiver"
      class="mt-4 text-sm text-stone-600"
    >
      A waiver can be signed on an open rental before the customer signs.
    </p>
  </section>
</template>
