<script setup lang="ts">
import type { PublicWaiverAcceptance } from '~/types/waiver'
import type { WaiverInviteSendResult } from '~/types/waiver-invite'
import { formatBusinessDateTime } from '~/utils/datetime'

const props = defineProps<{
  rentalUuid: string
  canInvite: boolean
  waiver?: PublicWaiverAcceptance | null
  disabled?: boolean
  plain?: boolean
  prepare?: () => Promise<boolean>
}>()

const toast = useToast()
const email = ref('')
const waiverUrl = ref('')
const sending = ref(false)
const copied = ref(false)
const linkInput = ref<HTMLInputElement | null>(null)
const formError = ref('')

async function createLink(options: { copy?: boolean, notify?: boolean } = {}) {
  if (!props.canInvite) {
    return
  }

  formError.value = ''
  copied.value = false

  if (props.prepare) {
    const ready = await props.prepare()
    if (!ready) {
      return
    }
  }

  sending.value = true
  try {
    const result = await $fetch<WaiverInviteSendResult>(
      `/api/admin/rentals/${props.rentalUuid}/waiver-invite`,
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

onMounted(() => {
  if (props.canInvite && !waiverUrl.value && !props.prepare) {
    void createLink({ copy: false, notify: false })
  }
})
</script>

<template>
  <section :class="plain ? '' : 'rounded-xl border border-stone-200 bg-white p-5'">
    <h3
      v-if="!plain"
      class="text-sm font-medium text-stone-900"
    >
      {{ waiver ? 'Waiver' : 'Waiver sign link' }}
    </h3>
    <p :class="plain ? 'text-sm text-stone-500' : 'mt-1 text-sm text-stone-500'">
      {{ waiver
        ? 'The customer already agreed and signed this rental waiver.'
        : 'Copy this link and send it in Messenger, SMS, or email. The customer can open it without an account, agree to the terms, and sign.' }}
    </p>

    <AuthAlert
      v-if="formError"
      class="mt-4"
      :description="formError"
    />

    <div
      v-if="waiver"
      class="mt-4 space-y-3"
    >
      <p class="text-sm text-stone-800">
        Signed by {{ waiver.signerName }} on {{ formatBusinessDateTime(waiver.acceptedAt) }}.
      </p>
      <AdminSignedWaiverLink :rental-uuid="rentalUuid" />
    </div>

    <div
      v-else-if="canInvite"
      class="mt-4 space-y-3"
    >
      <div class="flex flex-col gap-2 sm:flex-row">
        <input
          ref="linkInput"
          :value="waiverUrl"
          readonly
          :placeholder="sending ? 'Creating link…' : 'No sign link yet. Create one below.'"
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

      <UButton
        type="button"
        :loading="sending"
        :disabled="disabled"
        @click="createLink"
      >
        {{ waiverUrl ? 'Create a new link and copy' : 'Create sign link' }}
      </UButton>

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

    <p
      v-else
      class="mt-4 text-sm text-stone-600"
    >
      A sign link can only be created on an open rental before the customer signs.
    </p>
  </section>
</template>
