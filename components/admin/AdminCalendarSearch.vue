<script setup lang="ts">
import type { AdminCalendarEvent } from '~/types/calendar'
import { bookingColor } from '~/utils/calendar'
import { formatBookingDateRange } from '~/utils/datetime'

const emit = defineEmits<{
  pick: [item: AdminCalendarEvent]
}>()

const searchInput = ref('')
const search = refDebounced(searchInput, 300)
const results = ref<AdminCalendarEvent[]>([])
const searching = ref(false)
const searched = ref('')
const errorMessage = ref('')
let latest = 0

const code = computed(() => search.value.trim().toUpperCase())

watch(code, async (value) => {
  errorMessage.value = ''
  if (value.length < 3) {
    results.value = []
    searched.value = ''
    return
  }

  const request = ++latest
  searching.value = true
  try {
    const response = await $fetch<{ items: AdminCalendarEvent[] }>('/api/admin/calendar/find', {
      query: { code: value },
    })
    if (request === latest) {
      results.value = response.items
      searched.value = value
    }
  }
  catch (caught) {
    if (request === latest) {
      results.value = []
      const payload = typeof caught === 'object' && caught && 'data' in caught
        ? (caught as { data?: { message?: string } }).data
        : null
      errorMessage.value = payload?.message || 'We could not search bookings.'
    }
  }
  finally {
    if (request === latest) {
      searching.value = false
    }
  }
})

function pick(item: AdminCalendarEvent) {
  emit('pick', item)
  searchInput.value = ''
  results.value = []
  searched.value = ''
}

function onSubmit() {
  const typed = searchInput.value.trim().toUpperCase()
  const exact = results.value.find(item => item.code === typed)
  const match = exact ?? (results.value.length === 1 ? results.value[0] : null)
  if (match) {
    pick(match)
  }
}
</script>

<template>
  <form
    class="relative block text-sm"
    method="get"
    role="search"
    @submit.prevent="onSubmit"
  >
    <span class="mb-1 block text-xs font-medium text-stone-600">Find booking ID</span>
    <UInput
      v-model="searchInput"
      class="w-full"
      icon="i-lucide-search"
      placeholder="JRY-20261013-00024"
      autocomplete="off"
      :loading="searching"
      maxlength="40"
    />
    <p
      v-if="errorMessage"
      class="mt-1 text-xs text-red-600"
    >
      {{ errorMessage }}
    </p>
    <ul
      v-else-if="results.length"
      class="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
    >
      <li
        v-for="item in results"
        :key="item.uuid"
      >
        <button
          type="button"
          class="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-stone-50"
          @click="pick(item)"
        >
          <span
            class="mt-1.5 size-2 shrink-0 rounded-full"
            :class="bookingColor(item.code).dot"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium text-stone-900">
              {{ item.code }}
            </span>
            <span class="block truncate text-xs text-stone-500">
              {{ item.productName }}
              <template v-if="item.customerName">
                · {{ item.customerName }}
              </template>
              · {{ formatBookingDateRange(item.startsOn, item.endsOn) }}
            </span>
          </span>
          <StatusBadge :status="item.status" />
        </button>
      </li>
    </ul>
    <p
      v-else-if="searched && !searching"
      class="mt-1 text-xs text-stone-500"
    >
      No booking on the calendar matches {{ searched }}. Cancelled and rejected requests stay off the board.
    </p>
  </form>
</template>
