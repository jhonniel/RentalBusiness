<script setup lang="ts">
import type { NotificationListResponse, PublicNotification } from '~/types/notification'
import { formatBusinessDateTime } from '~/utils/datetime'

const open = ref(false)
const { data, refresh } = await useFetch<NotificationListResponse>('/api/notifications', {
  key: 'account-notifications',
  query: { pageSize: 20 },
  lazy: true,
})

const items = computed(() => data.value?.items ?? [])
const recent = computed(() => items.value.slice(0, 6))
const unreadCount = computed(() => items.value.filter(item => !item.readAt).length)
const badgeLabel = computed(() => unreadCount.value > 9 ? '9+' : String(unreadCount.value))

watch(open, (isOpen) => {
  if (isOpen) {
    void refresh()
  }
})

async function markRead(item: PublicNotification) {
  if (item.readAt) {
    return
  }

  try {
    await $fetch(`/api/notifications/${item.uuid}/read`, { method: 'POST' })
    await refresh()
  }
  catch {
    // Keep the popover open; unread state updates on the next refresh.
  }
}
</script>

<template>
  <UPopover v-model:open="open">
    <UButton
      color="neutral"
      variant="ghost"
      square
      class="rounded-lg text-[#12201a]"
      :aria-label="unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'"
    >
      <span class="relative inline-flex">
        <UIcon
          name="i-lucide-bell"
          class="size-5"
        />
        <span
          v-if="unreadCount"
          class="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b42318] px-1 text-[10px] font-semibold text-white"
        >
          {{ badgeLabel }}
        </span>
      </span>
    </UButton>

    <template #content>
      <div class="w-[min(22rem,calc(100vw-1.5rem))]">
        <div class="flex items-center justify-between border-b border-[#12201a]/8 px-4 py-3">
          <p class="text-sm font-semibold text-[#12201a]">
            Notifications
          </p>
          <NuxtLink
            to="/notifications"
            class="text-xs font-medium text-[#5c6a64] hover:text-[#12201a]"
            @click="open = false"
          >
            View all
          </NuxtLink>
        </div>

        <p
          v-if="!recent.length"
          class="px-4 py-8 text-center text-sm text-[#5c6a64]"
        >
          No notifications yet.
        </p>

        <ul
          v-else
          class="max-h-80 divide-y divide-[#12201a]/8 overflow-y-auto"
        >
          <li
            v-for="item in recent"
            :key="item.uuid"
          >
            <button
              class="flex w-full flex-col items-start gap-1 px-4 py-3 text-left hover:bg-[#f7f8f7]"
              type="button"
              @click="markRead(item)"
            >
              <div class="flex w-full items-start justify-between gap-3">
                <p
                  class="text-sm text-[#12201a]"
                  :class="item.readAt ? 'font-medium' : 'font-semibold'"
                >
                  {{ item.title }}
                </p>
                <span
                  v-if="!item.readAt"
                  class="mt-1 size-2 shrink-0 rounded-full bg-[#b42318]"
                  aria-label="Unread"
                />
              </div>
              <p class="line-clamp-2 text-xs text-[#5c6a64]">
                {{ item.body }}
              </p>
              <p class="text-[11px] text-[#7a8781]">
                {{ formatBusinessDateTime(item.createdAt) }}
              </p>
            </button>
          </li>
        </ul>
      </div>
    </template>
  </UPopover>
</template>
