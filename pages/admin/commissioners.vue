<script setup lang="ts">
import type { AdminCommission, AdminCommissionsResponse } from '~/types/commission'
import { formatBusinessDate, formatBusinessDateTime } from '~/utils/datetime'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Commissioners',
  path: '/admin/commissioners',
})

const toast = useToast()
const { formatMoney } = useCurrency()
const { data, error, pending, refresh } = await useFetch<AdminCommissionsResponse>('/api/admin/commissions')
const confirmUuid = ref<string | null>(null)
const collecting = ref(false)
const filter = ref('')

const unavailable = computed(() => error.value?.statusCode === 503)
const visibleUnclaimed = computed(() => (data.value?.unclaimed ?? []).filter(item => !filter.value || item.commissioner.uuid === filter.value))
const visibleCollected = computed(() => (data.value?.collected ?? []).filter(item => !filter.value || item.commissioner.uuid === filter.value))
const totalUnclaimed = computed(() => visibleUnclaimed.value.reduce((sum, item) => sum + item.amount, 0))

function personName(item: { firstName: string, lastName: string }) {
  return `${item.firstName} ${item.lastName}`.trim() || 'Commissioner'
}

async function collect(item: AdminCommission) {
  collecting.value = true
  try {
    await $fetch(`/api/admin/commissions/${item.uuid}/collect`, { method: 'POST' })
    toast.add({
      title: `${formatMoney(item.amount)} marked collected for ${personName(item.commissioner)}`,
      color: 'success',
    })
    confirmUuid.value = null
    await refresh()
  }
  catch (caught) {
    const payload = typeof caught === 'object' && caught && 'data' in caught
      ? (caught as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payload?.message || 'We could not mark that commission collected.',
      color: 'error',
    })
  }
  finally {
    collecting.value = false
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
        Commissioners
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Commissions appear here once the booking is approved. Unpaid extensions are not counted. Mark one collected after the commissioner is paid.
      </p>
    </div>

    <AdminNotice
      v-if="unavailable"
      title="Commissions are not connected"
      description="Add live Supabase credentials to load commissions."
    />

    <AdminNotice
      v-else-if="error"
      tone="alert"
      title="Commissions could not be loaded"
      description="Try again in a moment."
    />

    <div
      v-else-if="pending && !data"
      class="space-y-3"
      role="status"
      aria-busy="true"
    >
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-40 w-full" />
    </div>

    <template v-else-if="data">
      <section class="rounded-xl border border-stone-200 bg-white p-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 class="text-sm font-medium text-stone-900">
              By commissioner
            </h3>
            <p class="mt-1 text-xs text-stone-500">
              Unclaimed is earned but not yet paid out.
            </p>
          </div>
          <label class="block text-sm sm:w-64">
            <span class="mb-1.5 block text-stone-700">Show</span>
            <select
              v-model="filter"
              class="h-10 w-full rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-800"
            >
              <option value="">
                All commissioners
              </option>
              <option
                v-for="person in data.summary"
                :key="person.uuid"
                :value="person.uuid"
              >
                {{ personName(person) }}
              </option>
            </select>
          </label>
        </div>

        <ul
          v-if="data.summary.length"
          class="mt-4 divide-y divide-stone-100"
        >
          <li
            v-for="person in data.summary"
            :key="person.uuid"
            class="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span class="font-medium text-stone-900">{{ personName(person) }}</span>
            <span class="flex flex-wrap gap-x-4 gap-y-1 text-stone-600">
              <span>Unclaimed <span class="font-medium text-stone-900">{{ formatMoney(person.unclaimedAmount) }}</span>
                <template v-if="person.unclaimedCount"> · {{ person.unclaimedCount }} booking{{ person.unclaimedCount === 1 ? '' : 's' }}</template>
              </span>
              <span>Collected {{ formatMoney(person.collectedAmount) }}</span>
            </span>
          </li>
        </ul>
        <p
          v-else
          class="mt-4 text-sm text-stone-500"
        >
          No commissions yet. They appear after a commissioner booking is approved.
        </p>
      </section>

      <section class="rounded-xl border border-stone-200 bg-white p-5">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="text-sm font-medium text-stone-900">
            Unclaimed
          </h3>
          <span class="text-sm text-stone-600">Total {{ formatMoney(totalUnclaimed) }}</span>
        </div>
        <ul
          v-if="visibleUnclaimed.length"
          class="mt-3 divide-y divide-stone-100"
        >
          <li
            v-for="item in visibleUnclaimed"
            :key="item.uuid"
            class="flex flex-col gap-3 py-4 text-sm lg:flex-row lg:items-center lg:justify-between"
          >
            <div class="min-w-0 space-y-0.5">
              <p class="font-medium text-stone-900">
                {{ personName(item.commissioner) }} · {{ formatMoney(item.amount) }}
              </p>
              <p class="break-words text-stone-600">
                <NuxtLink
                  :to="`/admin/rentals/${item.rental.code}`"
                  class="text-lumen-700 hover:text-lumen-800"
                >
                  {{ item.rental.code }}
                </NuxtLink>
                · {{ item.rental.equipment }}
              </p>
              <p class="text-xs text-stone-500">
                Recorded {{ formatBusinessDate(item.earnedOn) }}
                <template v-if="item.rental.returnAt">
                  · returned by {{ formatBusinessDateTime(item.rental.returnAt) }}
                </template>
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <template v-if="confirmUuid === item.uuid">
                <UButton
                  size="sm"
                  class="min-w-[8rem] flex-1 justify-center lg:flex-none"
                  :loading="collecting"
                  @click="collect(item)"
                >
                  Confirm collected
                </UButton>
                <UButton
                  size="sm"
                  color="neutral"
                  variant="outline"
                  class="min-w-[8rem] flex-1 justify-center lg:flex-none"
                  :disabled="collecting"
                  @click="confirmUuid = null"
                >
                  Cancel
                </UButton>
              </template>
              <UButton
                v-else
                size="sm"
                color="neutral"
                variant="outline"
                class="min-w-[8rem] flex-1 justify-center lg:flex-none"
                @click="confirmUuid = item.uuid"
              >
                Mark as collected
              </UButton>
            </div>
          </li>
        </ul>
        <p
          v-else
          class="mt-3 text-sm text-stone-500"
        >
          No unclaimed commissions.
        </p>
      </section>

      <section class="rounded-xl border border-stone-200 bg-white p-5">
        <h3 class="text-sm font-medium text-stone-900">
          Collected
        </h3>
        <ul
          v-if="visibleCollected.length"
          class="mt-3 divide-y divide-stone-100"
        >
          <li
            v-for="item in visibleCollected"
            :key="item.uuid"
            class="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0">
              <p class="text-stone-900">
                {{ personName(item.commissioner) }} ·
                <NuxtLink
                  :to="`/admin/rentals/${item.rental.code}`"
                  class="text-lumen-700 hover:text-lumen-800"
                >
                  {{ item.rental.code }}
                </NuxtLink>
              </p>
              <p class="text-xs text-stone-500">
                Collected {{ item.collectedAt ? formatBusinessDateTime(item.collectedAt) : '' }}
              </p>
            </div>
            <span class="text-stone-900">{{ formatMoney(item.amount) }}</span>
          </li>
        </ul>
        <p
          v-else
          class="mt-3 text-sm text-stone-500"
        >
          Nothing collected yet.
        </p>
      </section>
    </template>
  </div>
</template>
