<script setup lang="ts">
import type { AvailabilityCalendar } from '~/types/availability'
import type { PublicRental, RentalReschedulePreview } from '~/types/rental'
import { formatBusinessDateTime } from '~/utils/datetime'
import { defaultRentalReturnOn, normalizePickupTime } from '~/utils/rental-window'

const props = defineProps<{
  rental: PublicRental
}>()

const emit = defineEmits<{
  rescheduled: []
}>()

const toast = useToast()
const { formatMoney } = useCurrency()
const { authHeaders } = useAuth()
const open = ref(false)
const startsOn = ref(props.rental.startsOn)
const endsOn = ref(props.rental.endsOn)
const pickupTime = ref(normalizePickupTime(props.rental.pickupTime))
const preview = ref<RentalReschedulePreview | null>(null)
const previewError = ref('')
const previewing = ref(false)
const saving = ref(false)
const calendar = ref<AvailabilityCalendar | null>(null)

const changed = computed(() => (
  startsOn.value !== props.rental.startsOn
  || endsOn.value !== props.rental.endsOn
  || pickupTime.value !== normalizePickupTime(props.rental.pickupTime)
))

function errorMessage(error: unknown, fallback: string) {
  const payload = typeof error === 'object' && error && 'data' in error
    ? (error as { data?: { message?: string } }).data
    : null
  return payload?.message || fallback
}

async function start() {
  open.value = true
  startsOn.value = props.rental.startsOn
  endsOn.value = props.rental.endsOn
  pickupTime.value = normalizePickupTime(props.rental.pickupTime)
  preview.value = null
  previewError.value = ''
  try {
    calendar.value = await $fetch<AvailabilityCalendar>(`/api/rentals/${props.rental.uuid}/calendar`, {
      headers: authHeaders(),
    })
  }
  catch {
    calendar.value = null
  }
}

watch(startsOn, (value, previous) => {
  if (!value) {
    return
  }
  if (!endsOn.value || endsOn.value <= value || (previous && endsOn.value === defaultRentalReturnOn(previous))) {
    endsOn.value = defaultRentalReturnOn(value)
  }
})

async function loadPreview() {
  preview.value = null
  previewError.value = ''
  if (!open.value || !changed.value || !startsOn.value || !endsOn.value) {
    return
  }

  previewing.value = true
  try {
    preview.value = await $fetch<RentalReschedulePreview>(`/api/rentals/${props.rental.uuid}/schedule`, {
      method: 'POST',
      headers: authHeaders(),
      body: { startsOn: startsOn.value, endsOn: endsOn.value, pickupTime: pickupTime.value, preview: true },
    })
  }
  catch (error) {
    previewError.value = errorMessage(error, 'We could not price those dates.')
  }
  finally {
    previewing.value = false
  }
}

watchDebounced(
  () => [open.value, startsOn.value, endsOn.value, pickupTime.value],
  () => {
    void loadPreview()
  },
  { debounce: 300 },
)

async function save() {
  if (!preview.value?.canFulfill) {
    return
  }

  saving.value = true
  try {
    await $fetch(`/api/rentals/${props.rental.uuid}/schedule`, {
      method: 'POST',
      headers: authHeaders(),
      body: { startsOn: startsOn.value, endsOn: endsOn.value, pickupTime: pickupTime.value },
    })
    toast.add({ title: 'Dates updated', color: 'success' })
    open.value = false
    emit('rescheduled')
  }
  catch (error) {
    previewError.value = errorMessage(error, 'We could not change those dates.')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="rounded-2xl border border-stone-200 bg-white p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-sm font-medium text-stone-900">
          Change dates
        </h2>
        <p class="mt-1 text-sm text-stone-600">
          This booking is still a draft, so you can move the pickup and return.
        </p>
      </div>
      <UButton
        v-if="!open"
        color="neutral"
        variant="outline"
        class="w-full justify-center sm:w-auto"
        @click="start"
      >
        Reschedule
      </UButton>
    </div>

    <div
      v-if="open"
      class="mt-4 space-y-4"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <BookingDateField
          v-model="startsOn"
          label="Pickup date"
          :availability="calendar"
          :until="endsOn || undefined"
          :disabled="saving"
        />
        <BookingPickupTime
          v-model="pickupTime"
          :availability="calendar"
          :starts-on="startsOn"
          :ends-on="endsOn"
          :disabled="saving"
        />
        <BookingDateField
          v-model="endsOn"
          label="Return date"
          :availability="calendar"
          :min="startsOn || undefined"
          :disabled="saving"
        />
      </div>

      <dl
        v-if="preview"
        class="space-y-1.5 rounded-xl bg-stone-50 p-4 text-sm"
      >
        <div class="flex justify-between gap-4">
          <dt class="text-stone-500">
            New schedule
          </dt>
          <dd class="text-right">
            {{ formatBusinessDateTime(preview.pickupAt) }} – {{ formatBusinessDateTime(preview.returnAt) }}
          </dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-stone-500">
            {{ preview.days }} day{{ preview.days === 1 ? '' : 's' }}
          </dt>
          <dd>{{ formatMoney(preview.rentAmount) }}</dd>
        </div>
        <div
          v-if="preview.lessAmount > 0"
          class="flex justify-between gap-4"
        >
          <dt class="text-stone-500">
            Less
          </dt>
          <dd>−{{ formatMoney(preview.lessAmount) }}</dd>
        </div>
        <div
          v-if="preview.discountAmount > 0"
          class="flex justify-between gap-4"
        >
          <dt class="text-stone-500">
            Voucher
          </dt>
          <dd>−{{ formatMoney(preview.discountAmount) }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-stone-500">
            Deposit
          </dt>
          <dd>{{ formatMoney(preview.depositAmount) }}</dd>
        </div>
        <div class="flex justify-between gap-4 font-medium text-stone-900">
          <dt>Amount due</dt>
          <dd>{{ formatMoney(preview.amountDue) }}</dd>
        </div>
        <p
          v-if="!preview.canFulfill"
          class="pt-1 text-red-800"
        >
          Those dates are not available. Choose other dates.
        </p>
      </dl>
      <p
        v-else-if="!changed"
        class="text-sm text-stone-500"
      >
        Pick new dates or a new pickup time.
      </p>
      <p
        v-if="previewError"
        class="text-sm text-red-800"
      >
        {{ previewError }}
      </p>

      <div class="flex flex-col gap-2 sm:flex-row">
        <UButton
          class="w-full justify-center sm:w-auto"
          :loading="saving || previewing"
          :disabled="!preview?.canFulfill"
          @click="save"
        >
          Save new dates
        </UButton>
        <UButton
          color="neutral"
          variant="ghost"
          class="w-full justify-center sm:w-auto"
          :disabled="saving"
          @click="open = false"
        >
          Keep current dates
        </UButton>
      </div>
    </div>
  </section>
</template>
