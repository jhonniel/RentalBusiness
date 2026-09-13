<script setup lang="ts">
import type { AdminCustomerListResponse } from '~/types/notification'
import { formatBusinessDate } from '~/utils/datetime'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Customers',
  path: '/admin/customers',
})

const searchInput = ref('')
const search = refDebounced(searchInput, 300)
const page = ref(1)
const query = computed(() => ({
  search: search.value || undefined,
  page: page.value,
  pageSize: 20,
}))

const { data, error, pending } = await useFetch<AdminCustomerListResponse>('/api/admin/customers', {
  query,
  watch: [query],
})

const unavailable = computed(() => error.value?.statusCode === 503)
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / 20)))

watch(search, () => {
  page.value = 1
})
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Operations
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        Customers
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Customer profiles and how many rentals they have requested.
      </p>
    </div>

    <form
      method="get"
      @submit.prevent
    >
      <input
        v-model="searchInput"
        class="w-full max-w-sm rounded-md border border-stone-200 px-3 py-2 text-sm"
        placeholder="Search name"
      >
    </form>

    <AdminNotice
      v-if="unavailable"
      title="Customers are not connected"
      description="Add live Supabase credentials to load customer profiles."
    />

    <div
      v-else-if="pending && !data"
      class="space-y-3"
    >
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-16 w-full" />
    </div>

    <AdminNotice
      v-else-if="!data?.items.length"
      title="No customers"
      description="Registered customers will appear here."
    />

    <ul
      v-else
      class="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white"
    >
      <li
        v-for="customer in data.items"
        :key="customer.uuid"
        class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0">
          <p class="font-medium text-stone-900">
            {{ customer.firstName }} {{ customer.lastName }}
          </p>
          <p class="text-sm break-words text-stone-500">
            {{ customer.phone || 'No phone' }} · joined {{ formatBusinessDate(customer.createdAt) }}
          </p>
        </div>
        <p class="text-sm text-stone-600">
          {{ customer.rentalCount }} rental{{ customer.rentalCount === 1 ? '' : 's' }}
        </p>
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
