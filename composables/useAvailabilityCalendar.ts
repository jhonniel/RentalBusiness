import type { AvailabilityCalendar } from '~/types/availability'

const calendarCache = new Map<string, AvailabilityCalendar>()
const calendarInflight = new Map<string, Promise<AvailabilityCalendar>>()

function calendarKey(input: { productUuid?: string, productSlug?: string, quantity?: number }) {
  return `${input.productUuid || ''}:${input.productSlug || ''}:${input.quantity || 1}`
}

async function fetchAvailabilityCalendar(input: {
  productUuid?: string
  productSlug?: string
  quantity?: number
}) {
  const key = calendarKey(input)
  const cached = calendarCache.get(key)
  if (cached) {
    return cached
  }

  const inflight = calendarInflight.get(key)
  if (inflight) {
    return inflight
  }

  const request = $fetch<AvailabilityCalendar>('/api/availability/calendar', {
    query: {
      quantity: input.quantity ?? 1,
      ...(input.productUuid ? { productUuid: input.productUuid } : {}),
      ...(input.productSlug ? { productSlug: input.productSlug } : {}),
    },
  }).then((data) => {
    calendarCache.set(key, data)
    calendarInflight.delete(key)
    return data
  }).catch((error) => {
    calendarInflight.delete(key)
    throw error
  })

  calendarInflight.set(key, request)
  return request
}

export function useAvailabilityCalendar(source: () => {
  productUuid?: string
  productSlug?: string
  quantity?: number
}) {
  const calendar = ref<AvailabilityCalendar | null>(null)
  const pending = ref(false)
  const query = computed(source)
  const enabled = computed(() => Boolean(query.value.productUuid || query.value.productSlug))

  async function load() {
    if (!enabled.value) {
      calendar.value = null
      return
    }

    pending.value = true
    try {
      calendar.value = await fetchAvailabilityCalendar(query.value)
    }
    catch {
      calendar.value = null
    }
    finally {
      pending.value = false
    }
  }

  watch(query, () => {
    void load()
  }, { immediate: true, deep: true })

  return {
    calendar,
    pending,
    enabled,
    load,
  }
}
