<script setup lang="ts">
import type { AuditLogListResponse } from '~/types/audit'
import { auditTargetHref } from '~/utils/audit-log'
import { formatBusinessDateTime } from '~/utils/datetime'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Audit logs',
  path: '/admin/audit-logs',
})

const searchInput = ref('')
const search = refDebounced(searchInput, 300)
const entity = ref('')
const page = ref(1)

const query = computed(() => ({
  search: search.value || undefined,
  entity: entity.value || undefined,
  page: page.value,
  pageSize: 20,
}))

const { data, error, pending } = await useFetch<AuditLogListResponse>('/api/admin/audit-logs', {
  query,
  watch: [query],
})

const unavailable = computed(() => error.value?.statusCode === 503)
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / 20)))

watch([search, entity], () => {
  page.value = 1
})

function changeSummary(value: Record<string, unknown> | null) {
  if (!value) {
    return '—'
  }

  return Object.entries(value)
    .map(([key, entry]) => `${key}: ${typeof entry === 'object' ? JSON.stringify(entry) : String(entry)}`)
    .join(' · ')
}
</script>

<template>
  <div class="w-full space-y-6">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Operations
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        Audit logs
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Historical admin and system actions. Rows are append-only and cannot be edited or deleted here.
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
        placeholder="Search action, entity, or public id"
      >
      <input
        v-model="entity"
        class="rounded-md border border-stone-200 px-3 py-2 text-sm"
        placeholder="Entity, e.g. rental_requests"
      >
    </form>

    <AdminNotice
      v-if="unavailable"
      title="Audit logs are not connected"
      description="Add live Supabase credentials to load the audit trail."
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
      title="No audit logs"
      description="Admin changes and system actions will appear here after they are recorded."
    />

    <ul
      v-else
      class="space-y-3 md:hidden"
    >
      <li
        v-for="item in data.items"
        :key="item.uuid"
        class="rounded-xl border border-stone-200 bg-white p-4"
      >
        <p class="font-medium break-words text-stone-900">
          {{ item.action }}
        </p>
        <p class="mt-1 text-sm break-words text-stone-500">
          {{ item.entity }}
          · {{ item.entityId }}
        </p>
        <p class="mt-1 text-sm text-stone-500">
          {{ item.actor?.name || 'System' }}
          · {{ formatBusinessDateTime(item.createdAt) }}
        </p>
        <NuxtLink
          v-if="auditTargetHref(item.entity, item.entityId)"
          :to="auditTargetHref(item.entity, item.entityId)!"
          class="mt-2 inline-block text-sm text-lumen-800 hover:underline"
        >
          Open record
        </NuxtLink>
        <details
          v-if="item.previousValue || item.nextValue"
          class="mt-3"
        >
          <summary class="cursor-pointer text-sm font-medium text-stone-700">
            Changes
          </summary>
          <p class="mt-2 text-xs break-words text-stone-600">
            Before: {{ changeSummary(item.previousValue) }}
          </p>
          <p class="mt-1 text-xs break-words text-stone-600">
            After: {{ changeSummary(item.nextValue) }}
          </p>
        </details>
      </li>
    </ul>

    <div
      v-if="data?.items.length"
      class="hidden overflow-x-auto rounded-xl border border-stone-200 bg-white md:block"
    >
      <table class="min-w-full text-left text-sm">
        <thead class="bg-stone-50 text-stone-500">
          <tr>
            <th class="px-4 py-3 font-medium">
              When
            </th>
            <th class="px-4 py-3 font-medium">
              Action
            </th>
            <th class="px-4 py-3 font-medium">
              Actor
            </th>
            <th class="px-4 py-3 font-medium">
              Record
            </th>
            <th class="px-4 py-3 font-medium">
              Changes
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-stone-100">
          <tr
            v-for="item in data.items"
            :key="item.uuid"
          >
            <td class="whitespace-nowrap px-4 py-3 text-stone-600">
              {{ formatBusinessDateTime(item.createdAt) }}
            </td>
            <td class="px-4 py-3 font-medium text-stone-900">
              {{ item.action }}
            </td>
            <td class="px-4 py-3 text-stone-600">
              {{ item.actor?.name || 'System' }}
            </td>
            <td class="px-4 py-3">
              <p class="text-stone-600">
                {{ item.entity }}
              </p>
              <NuxtLink
                v-if="auditTargetHref(item.entity, item.entityId)"
                :to="auditTargetHref(item.entity, item.entityId)!"
                class="break-all text-lumen-800 hover:underline"
              >
                {{ item.entityId }}
              </NuxtLink>
              <p
                v-else
                class="break-all text-stone-900"
              >
                {{ item.entityId }}
              </p>
            </td>
            <td class="max-w-sm px-4 py-3 text-xs text-stone-500">
              <details v-if="item.previousValue || item.nextValue">
                <summary class="cursor-pointer text-stone-700">
                  View
                </summary>
                <p class="mt-2 break-words">
                  Before: {{ changeSummary(item.previousValue) }}
                </p>
                <p class="mt-1 break-words">
                  After: {{ changeSummary(item.nextValue) }}
                </p>
              </details>
              <span v-else>—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

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
