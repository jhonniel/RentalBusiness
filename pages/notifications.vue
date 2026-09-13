<script setup lang="ts">
import type { NotificationListResponse, PublicNotification } from '~/types/notification'
import { formatBusinessDateTime } from '~/utils/datetime'

definePageMeta({
  middleware: 'auth',
})

useSiteMeta({
  title: 'Notifications',
  path: '/notifications',
})

const { data, error, pending, refresh } = await useFetch<NotificationListResponse>('/api/notifications', {
  query: { pageSize: 20 },
})

const hasData = computed(() => Boolean(data.value))
const remote = useRemoteState(error, pending, hasData)

async function markRead(item: PublicNotification) {
  if (item.readAt) {
    return
  }

  try {
    await $fetch(`/api/notifications/${item.uuid}/read`, { method: 'POST' })
    await refresh()
  }
  catch {
    // Keep the list visible; the next refresh will show unread state.
  }
}
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
    <AccountNav />

    <h1 class="mt-8 text-3xl font-semibold tracking-tight text-slate-900">
      Notifications
    </h1>
    <p class="mt-2 text-stone-600">
      Updates for your account, including approved rentals.
    </p>

    <CatalogNotice
      v-if="remote.unavailable"
      class="mt-8"
      title="Notifications are not connected"
      description="Add live Supabase credentials to load messages."
    />

    <CatalogNotice
      v-else-if="remote.failed"
      class="mt-8"
      tone="alert"
      title="Notifications could not load"
      description="Try again in a moment. Account updates will appear here when the request succeeds."
    />

    <div
      v-else-if="remote.loading"
      class="mt-8 space-y-3"
      role="status"
      aria-busy="true"
    >
      <USkeleton class="h-20 w-full" />
      <USkeleton class="h-20 w-full" />
    </div>

    <CatalogNotice
      v-else-if="!data?.items.length"
      class="mt-8"
      title="No notifications"
      description="Approvals and reminders will appear here."
    />

    <ul
      v-else
      class="mt-8 divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white"
    >
      <li
        v-for="item in data.items"
        :key="item.uuid"
      >
        <button
          class="flex w-full flex-col items-start gap-1 px-4 py-4 text-left hover:bg-stone-50"
          type="button"
          @click="markRead(item)"
        >
          <div class="flex w-full items-center justify-between gap-3">
            <p class="font-medium text-stone-900">
              {{ item.title }}
            </p>
            <span
              v-if="!item.readAt"
              class="size-2 rounded-full bg-lumen-700"
              aria-label="Unread"
            />
          </div>
          <p class="text-sm text-stone-600">
            {{ item.body }}
          </p>
          <p class="text-xs text-stone-400">
            {{ formatBusinessDateTime(item.createdAt) }}
          </p>
        </button>
      </li>
    </ul>
  </section>
</template>
