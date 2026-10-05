<script setup lang="ts">
import type { AdminCustomer, AdminCustomerListResponse, AdminSystemUser } from '~/types/notification'
import { formatBusinessDate } from '~/utils/datetime'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Customers',
  path: '/admin/customers',
})

const toast = useToast()
const { profile } = useAuth()
const searchInput = ref('')
const search = refDebounced(searchInput, 300)
const page = ref(1)
const query = computed(() => ({
  search: search.value || undefined,
  page: page.value,
  pageSize: 20,
}))

const { data, error, pending, refresh } = await useFetch<AdminCustomerListResponse>('/api/admin/customers', {
  query,
  watch: [query],
})
const {
  data: systemUsers,
  error: systemError,
  pending: systemPending,
  refresh: refreshSystemUsers,
} = await useFetch<AdminSystemUser[]>('/api/admin/system-users')

const unavailable = computed(() => error.value?.statusCode === 503 || systemError.value?.statusCode === 503)
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / 20)))
const confirmUuid = ref<string | null>(null)
const promoting = ref(false)

watch(search, () => {
  page.value = 1
})

function displayName(person: { firstName: string, lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim() || 'This account'
}

async function promote(customer: AdminCustomer) {
  promoting.value = true
  try {
    await $fetch(`/api/admin/customers/${customer.uuid}/promote`, { method: 'POST' })
    confirmUuid.value = null
    toast.add({ title: `${displayName(customer)} is now a system user`, color: 'success' })
    await Promise.all([refresh(), refreshSystemUsers()])
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payload?.message || 'We could not make that customer a system user.',
      color: 'error',
    })
  }
  finally {
    promoting.value = false
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
        Customers
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Customer profiles and the system users who can run the shop.
      </p>
    </div>

    <AdminNotice
      v-if="unavailable"
      title="Customers are not connected"
      description="Add live Supabase credentials to load customer profiles."
    />

    <template v-else>
      <section class="space-y-3">
        <div>
          <h3 class="text-sm font-medium text-stone-900">
            System users
          </h3>
          <p class="mt-1 text-sm text-stone-500">
            These accounts can open the operations console. Promote a customer to add another admin.
          </p>
        </div>

        <div
          v-if="systemPending && !systemUsers"
          class="space-y-3"
        >
          <USkeleton class="h-16 w-full" />
        </div>

        <AdminNotice
          v-else-if="!systemUsers?.length"
          title="No system users"
          description="The signed-in admin should appear here after profiles load."
        />

        <ul
          v-else
          class="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white"
        >
          <li
            v-for="user in systemUsers"
            :key="user.uuid"
            class="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div class="min-w-0">
              <p class="font-medium text-stone-900">
                {{ displayName(user) }}
                <span
                  v-if="user.uuid === profile?.uuid"
                  class="ml-2 text-xs font-normal text-stone-500"
                >You</span>
              </p>
              <p class="text-sm break-words text-stone-500">
                {{ user.email || 'No account email' }} · joined {{ formatBusinessDate(user.createdAt) }}
              </p>
            </div>
            <p class="text-sm text-stone-600">
              Admin
            </p>
          </li>
        </ul>
      </section>

      <form
        class="rounded-xl border border-stone-200 bg-white p-4"
        method="get"
        @submit.prevent
      >
        <input
          v-model="searchInput"
          class="w-full rounded-md border border-stone-200 px-3 py-2 text-sm lg:max-w-md"
          placeholder="Search name"
        >
      </form>

      <div
        v-if="pending && !data"
        class="space-y-3"
      >
        <USkeleton class="h-16 w-full" />
        <USkeleton class="h-16 w-full" />
      </div>

      <AdminNotice
        v-else-if="!data?.items.length"
        title="No customers"
        description="Registered customers will appear here. You can make one a system user."
      />

      <ul
        v-else
        class="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white"
      >
        <li
          v-for="customer in data.items"
          :key="customer.uuid"
          class="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
        >
          <div class="min-w-0">
            <p class="font-medium text-stone-900">
              {{ displayName(customer) }}
            </p>
            <p class="text-sm break-words text-stone-500">
              {{ customer.email || 'No account email' }}
              · {{ customer.phone || 'No phone' }}
              · joined {{ formatBusinessDate(customer.createdAt) }}
            </p>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-3">
            <p class="text-sm text-stone-600">
              {{ customer.rentalCount }} rental{{ customer.rentalCount === 1 ? '' : 's' }}
            </p>
            <template v-if="confirmUuid === customer.uuid">
              <UButton
                size="xs"
                :loading="promoting"
                @click="promote(customer)"
              >
                Make system user
              </UButton>
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                :disabled="promoting"
                @click="confirmUuid = null"
              >
                Cancel
              </UButton>
            </template>
            <UButton
              v-else
              color="neutral"
              variant="outline"
              size="xs"
              @click="confirmUuid = customer.uuid"
            >
              Make admin
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
    </template>
  </div>
</template>
