<script setup lang="ts">
import type { RentalListResponse } from '~/types/rental'
import { RENTAL_STATUSES } from '~/utils/constants'
import { formatBusinessDate } from '~/utils/datetime'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Rentals',
  path: '/admin/rentals',
})

const searchInput = ref('')
const search = refDebounced(searchInput, 300)
const status = ref('')
const page = ref(1)
const { formatMoney } = useCurrency()

const query = computed(() => ({
  search: search.value || undefined,
  status: status.value || undefined,
  page: page.value,
  pageSize: 20,
}))

const toast = useToast()
const deleteCode = ref('')
const deletePending = ref(false)

const { data, error, pending, refresh } = await useFetch<RentalListResponse>('/api/admin/rentals', {
  query,
  watch: [query],
})

const unavailable = computed(() => error.value?.statusCode === 503)
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / 20)))

watch([search, status], () => {
  page.value = 1
})

async function removeRental(uuid: string) {
  deletePending.value = true
  try {
    await $fetch(`/api/admin/rentals/${uuid}`, { method: 'DELETE' })
    toast.add({ title: 'Rental deleted', color: 'success' })
    deleteCode.value = ''
    await refresh()
  }
  catch (caught) {
    const payload = typeof caught === 'object' && caught && 'data' in caught
      ? (caught as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payload?.message || 'We could not delete that rental.',
      color: 'error',
    })
  }
  finally {
    deletePending.value = false
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Operations
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        Rentals
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Confirm new requests, review payment, approve paid rentals, or delete a request.
      </p>
    </div>

    <form
      class="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-2"
      method="get"
      @submit.prevent
    >
      <input
        v-model="searchInput"
        class="rounded-md border border-stone-200 px-3 py-2 text-sm"
        placeholder="Search code"
      >
      <select
        v-model="status"
        class="rounded-md border border-stone-200 px-3 py-2 text-sm"
      >
        <option value="">
          All statuses
        </option>
        <option
          v-for="item in RENTAL_STATUSES"
          :key="item"
          :value="item"
        >
          {{ item.replaceAll('_', ' ') }}
        </option>
      </select>
    </form>

    <AdminNotice
      v-if="unavailable"
      title="Rentals are not connected"
      description="Add live Supabase credentials to load rental requests."
    />

    <div
      v-else-if="pending && !data"
      class="space-y-3"
    >
      <USkeleton class="h-20 w-full" />
      <USkeleton class="h-20 w-full" />
    </div>

    <AdminNotice
      v-else-if="!data?.items.length"
      title="No rentals"
      description="Customer requests will appear here."
    />

    <ul
      v-else
      class="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white"
    >
      <li
        v-for="rental in data.items"
        :key="rental.uuid"
        class="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
      >
        <NuxtLink
          :to="`/admin/rentals/${rental.code}`"
          class="grid min-w-0 gap-3 hover:opacity-80 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_auto_auto] lg:items-center"
        >
          <div class="min-w-0">
            <p class="font-medium text-stone-900">
              {{ rental.items[0]?.product.name || rental.code }}
            </p>
            <p class="mt-1 text-sm break-words text-stone-500">
              {{ rental.code }}
              · {{ rental.customer ? `${rental.customer.firstName} ${rental.customer.lastName}` : 'Customer' }}
            </p>
          </div>
          <p class="text-sm text-stone-500">
            {{ formatBusinessDate(rental.startsOn) }} – {{ formatBusinessDate(rental.endsOn) }}
          </p>
          <span class="text-sm">{{ formatMoney(rental.totalAmount) }}</span>
          <StatusBadge :status="rental.status" />
        </NuxtLink>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <template v-if="deleteCode === rental.code">
            <UButton
              color="error"
              size="sm"
              :loading="deletePending"
              @click="removeRental(rental.uuid)"
            >
              Confirm
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="deletePending"
              @click="deleteCode = ''"
            >
              Cancel
            </UButton>
          </template>
          <UButton
            v-else
            color="error"
            variant="ghost"
            size="sm"
            @click="deleteCode = rental.code"
          >
            Delete
          </UButton>
        </div>
      </li>
    </ul>

    <div
      v-if="totalPages > 1"
      class="flex flex-wrap justify-end gap-2"
    >
      <UButton
        color="neutral"
        variant="outline"
        :disabled="page <= 1"
        @click="page -= 1"
      >
        Previous
      </UButton>
      <UButton
        color="neutral"
        variant="outline"
        :disabled="page >= totalPages"
        @click="page += 1"
      >
        Next
      </UButton>
    </div>
  </div>
</template>
