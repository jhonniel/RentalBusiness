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
const {
  data: commissioners,
  refresh: refreshCommissioners,
} = await useFetch<AdminSystemUser[]>('/api/admin/commissioners')

const unavailable = computed(() => error.value?.statusCode === 503 || systemError.value?.statusCode === 503)
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / 20)))
const confirmUuid = ref<string | null>(null)
const confirmRole = ref<'admin' | 'commissioner' | null>(null)
const promoting = ref(false)

watch(search, () => {
  page.value = 1
})

function displayName(person: { firstName: string, lastName: string, email?: string | null, walkIn?: boolean }) {
  const name = `${person.firstName} ${person.lastName}`.trim()
  if (name) {
    return name
  }
  if (person.walkIn) {
    return 'Walk-in customer'
  }
  return person.email || 'No name yet'
}

const deleteUuid = ref<string | null>(null)
const deleting = ref(false)

async function deleteAccount(person: { uuid: string, firstName: string, lastName: string }) {
  deleting.value = true
  try {
    await $fetch(`/api/admin/customers/${person.uuid}`, { method: 'DELETE' })
    deleteUuid.value = null
    toast.add({ title: `${displayName(person)} was deleted`, color: 'success' })
    await Promise.all([refresh(), refreshSystemUsers(), refreshCommissioners()])
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payload?.message || 'We could not delete that account.',
      color: 'error',
    })
  }
  finally {
    deleting.value = false
  }
}

const linkingUuid = ref<string | null>(null)

async function linkCommissioner(customer: AdminCustomer, commissionerUuid: string) {
  linkingUuid.value = customer.uuid
  try {
    const result = await $fetch<{ linkedCommissioner: AdminCustomer['linkedCommissioner'] }>(`/api/admin/customers/${customer.uuid}/assigned-commissioner`, {
      method: 'PATCH',
      body: { commissionerUuid },
    })
    toast.add({
      title: result.linkedCommissioner
        ? `${displayName(customer)} is linked to ${result.linkedCommissioner.firstName} ${result.linkedCommissioner.lastName}`
        : `${displayName(customer)} is no longer linked to a commissioner`,
      color: 'success',
    })
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    toast.add({ title: payload?.message || 'We could not link that commissioner.', color: 'error' })
    await refresh()
  }
  finally {
    linkingUuid.value = null
  }
}

async function promote(customer: AdminCustomer) {
  if (!confirmRole.value) {
    return
  }
  promoting.value = true
  const asCommissioner = confirmRole.value === 'commissioner'
  try {
    await $fetch(
      asCommissioner
        ? `/api/admin/customers/${customer.uuid}/commissioner`
        : `/api/admin/customers/${customer.uuid}/promote`,
      { method: 'POST' },
    )
    confirmUuid.value = null
    confirmRole.value = null
    toast.add({
      title: asCommissioner
        ? `${displayName(customer)} is now a commissioner`
        : `${displayName(customer)} is now a system user`,
      color: 'success',
    })
    await Promise.all([refresh(), refreshSystemUsers(), refreshCommissioners()])
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payload?.message || 'We could not change that account.',
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
        Customer profiles, system users, and commissioners who book equipment for clients.
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
            <div class="flex flex-wrap items-center justify-end gap-2">
              <p class="text-sm text-stone-600">
                Admin
              </p>
              <AdminDeleteAccount
                v-if="user.uuid !== profile?.uuid"
                :open="deleteUuid === user.uuid"
                :loading="deleting"
                @start="deleteUuid = user.uuid"
                @cancel="deleteUuid = null"
                @confirm="deleteAccount(user)"
              />
            </div>
          </li>
        </ul>
      </section>

      <section class="space-y-3">
        <div>
          <h3 class="text-sm font-medium text-stone-900">
            Commissioners
          </h3>
          <p class="mt-1 text-sm text-stone-500">
            These accounts can book equipment for a client. You set the commission per day on each product.
          </p>
        </div>
        <AdminNotice
          v-if="!commissioners?.length"
          title="No commissioners"
          description="Promote a customer to let them book equipment and earn a commission."
        />
        <ul
          v-else
          class="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white"
        >
          <li
            v-for="user in commissioners"
            :key="user.uuid"
            class="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div class="min-w-0">
              <p class="font-medium text-stone-900">
                {{ displayName(user) }}
              </p>
              <p class="text-sm break-words text-stone-500">
                {{ user.email || 'No account email' }} · joined {{ formatBusinessDate(user.createdAt) }}
              </p>
            </div>
            <div class="flex flex-wrap items-center justify-end gap-2">
              <p class="text-sm text-stone-600">
                Commissioner
              </p>
              <AdminDeleteAccount
                :open="deleteUuid === user.uuid"
                :loading="deleting"
                @start="deleteUuid = user.uuid"
                @cancel="deleteUuid = null"
                @confirm="deleteAccount(user)"
              />
            </div>
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
        v-else-if="error"
        title="Customers could not be loaded"
        description="Refresh this page. Customer accounts will appear here when the list loads."
      />

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
              {{ customer.walkIn ? 'Walk-in, no email given' : (customer.email || 'No account email') }}
              · {{ customer.phone || 'No phone' }}
              · joined {{ formatBusinessDate(customer.createdAt) }}
            </p>
            <label
              v-if="data.commissionerLinksAvailable !== false"
              class="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-600"
            >
              <UIcon
                name="i-lucide-handshake"
                class="size-3.5 shrink-0 text-stone-400"
              />
              <span>Commissioner</span>
              <select
                class="h-8 max-w-56 rounded-md border border-stone-200 bg-white px-2 text-xs text-stone-800"
                :value="customer.linkedCommissioner?.uuid || ''"
                :disabled="linkingUuid === customer.uuid"
                @change="linkCommissioner(customer, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">
                  Not linked
                </option>
                <option
                  v-for="person in commissioners"
                  :key="person.uuid"
                  :value="person.uuid"
                >
                  {{ displayName(person) }}
                </option>
              </select>
              <span
                v-if="customer.linkedCommissioner"
                class="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700"
              >
                Earns commission on new bookings
              </span>
            </label>
            <p
              v-else
              class="mt-2 text-xs text-stone-500"
            >
              Paste 20261026000000_customer_commissioner_binding.sql in Supabase to link customers to commissioners.
            </p>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-3">
            <p class="text-sm text-stone-600">
              {{ customer.rentalCount }} rental{{ customer.rentalCount === 1 ? '' : 's' }}
            </p>
            <template v-if="confirmUuid === customer.uuid">
              <UButton
                size="xs"
                :loading="promoting && confirmRole === 'commissioner'"
                @click="confirmRole = 'commissioner'; promote(customer)"
              >
                Make commissioner
              </UButton>
              <UButton
                size="xs"
                :loading="promoting && confirmRole === 'admin'"
                @click="confirmRole = 'admin'; promote(customer)"
              >
                Make system user
              </UButton>
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                :disabled="promoting"
                @click="confirmUuid = null; confirmRole = null"
              >
                Cancel
              </UButton>
            </template>
            <UButton
              v-else
              color="neutral"
              variant="outline"
              size="xs"
              @click="confirmUuid = customer.uuid; deleteUuid = null"
            >
              Change role
            </UButton>
            <AdminDeleteAccount
              :open="deleteUuid === customer.uuid"
              :loading="deleting"
              @start="deleteUuid = customer.uuid; confirmUuid = null; confirmRole = null"
              @cancel="deleteUuid = null"
              @confirm="deleteAccount(customer)"
            />
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
