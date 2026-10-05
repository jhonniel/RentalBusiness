<script setup lang="ts">
import {
  bookingsFromOccupyingWindows,
  firstOpenPickupTime,
  unavailablePickupTimes,
} from '~/utils/availability'
import { formatPickupClock, isPastBusinessDateTime, normalizePickupTime, pickupTimeSlots } from '~/utils/rental-window'

const model = defineModel<string>({ required: true })

const props = defineProps<{
  label?: string
  disabled?: boolean
  productUuid?: string
  productSlug?: string
  quantity?: number
  startsOn?: string
  endsOn?: string
  flexible?: boolean
  ownPickupAt?: string | null
  ownReturnAt?: string | null
}>()

const slots = pickupTimeSlots()
const { calendar } = useAvailabilityCalendar(() => ({
  productUuid: props.productUuid,
  productSlug: props.productSlug,
  quantity: props.quantity,
}))

const occupyingWindows = computed(() => {
  const windows = calendar.value?.occupyingWindows ?? []
  if (!props.ownPickupAt || !props.ownReturnAt) {
    return windows
  }

  const ownPickup = Date.parse(props.ownPickupAt)
  const ownReturn = Date.parse(props.ownReturnAt)
  return windows.filter((window) => {
    return Date.parse(window.pickupAt) !== ownPickup || Date.parse(window.returnAt) !== ownReturn
  })
})

const pickupBookings = computed(() => {
  const productUuid = calendar.value?.product.uuid
  if (!productUuid) {
    return []
  }

  if (occupyingWindows.value.length) {
    return bookingsFromOccupyingWindows(productUuid, occupyingWindows.value)
  }

  return (calendar.value?.bookedDates ?? []).map(date => ({
    productUuid,
    quantity: 1,
    startsOn: date,
    endsOn: date,
    status: 'approved' as const,
  }))
})

const booked = computed(() => {
  const productUuid = calendar.value?.product.uuid
  if (!productUuid || !props.startsOn) {
    return new Set<string>()
  }

  return new Set(unavailablePickupTimes({
    bookings: pickupBookings.value,
    productUuid,
    startsOn: props.startsOn,
    endsOn: props.endsOn,
  }).filter(time => !isPastBusinessDateTime(props.startsOn!, time)))
})

const past = computed(() => {
  if (!props.startsOn) {
    return new Set<string>()
  }

  return new Set(slots.filter(time => isPastBusinessDateTime(props.startsOn!, time)))
})

function optionState(slot: string): 'open' | 'past' | 'booked' {
  if (past.value.has(slot)) {
    return 'past'
  }
  if (booked.value.has(slot)) {
    return 'booked'
  }
  return 'open'
}

function isOptionDisabled(slot: string) {
  if (props.flexible) {
    return false
  }
  return past.value.has(slot) || booked.value.has(slot)
}

function optionLabel(slot: string) {
  const clock = formatPickupClock(slot)
  const state = optionState(slot)
  if (state === 'past') {
    return `${clock} · past`
  }
  if (state === 'booked') {
    return `${clock} · booked`
  }
  return clock
}

function syncPickupTime(value?: string) {
  if (props.flexible) {
    const normalized = value && slots.includes(value) ? value : normalizePickupTime(value)
    if (normalized !== model.value) {
      model.value = normalized
    }
    return
  }

  const normalized = normalizePickupTime(value)
  const blocked = new Set([...past.value, ...booked.value])
  const next = blocked.has(normalized)
    ? firstOpenPickupTime(blocked, normalized)
    : normalized
  if (next !== model.value) {
    model.value = next
  }
}

watch([past, booked], () => {
  if (!props.flexible) {
    syncPickupTime(model.value)
  }
})

watch(model, (value) => {
  if (props.flexible) {
    if (!slots.includes(value)) {
      model.value = normalizePickupTime(value)
    }
    return
  }

  if (past.value.has(value) || booked.value.has(value) || !slots.includes(value)) {
    syncPickupTime(value)
  }
}, { immediate: true })
</script>

<template>
  <label class="block text-sm tracking-normal">
    <span class="mb-2 block text-xs font-medium text-[#5b6b64]">
      {{ label || 'Pickup time' }}
    </span>
    <select
      v-model="model"
      class="h-12 w-full rounded-xl border border-[#12201a]/12 bg-white px-3.5 text-sm tracking-normal text-[#12201a] disabled:opacity-60"
      :disabled="disabled"
    >
      <option
        v-for="slot in slots"
        :key="slot"
        :value="slot"
        :disabled="isOptionDisabled(slot)"
      >
        {{ optionLabel(slot) }}
      </option>
    </select>
    <p
      v-if="flexible && startsOn && past.size"
      class="mt-2 text-xs text-stone-500"
    >
      Times marked past have already gone by. You can still choose one; the public booking page cannot.
    </p>
  </label>
</template>
