<script setup lang="ts">
import type { PublicBlockedDate } from '~/types/availability'
import type { AdminCalendarEvent } from '~/types/calendar'
import { formatBookingDate, formatBusinessDate } from '~/utils/datetime'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  date: string
  items: AdminCalendarEvent[]
  blocks: PublicBlockedDate[]
  canBlock: boolean
}>()

const emit = defineEmits<{
  block: [date: string]
  removed: []
}>()

const toast = useToast()
const removingUuid = ref<string | null>(null)
const confirmUuid = ref<string | null>(null)

const title = computed(() => (
  props.date ? formatBusinessDate(props.date) : 'Day details'
))

function rangeLabel(startsOn: string, endsOn: string) {
  if (startsOn === endsOn) {
    return formatBookingDate(startsOn)
  }

  return `${formatBookingDate(startsOn)} – ${formatBookingDate(endsOn)}`
}

function apiErrorMessage(caught: unknown, fallback: string) {
  const payload = typeof caught === 'object' && caught && 'data' in caught
    ? (caught as { data?: { message?: string } }).data
    : null
  return payload?.message || fallback
}

async function removeBlock(uuid: string) {
  removingUuid.value = uuid
  try {
    await $fetch(`/api/admin/blocked-dates/${uuid}`, { method: 'DELETE' })
    toast.add({ title: 'Block removed', color: 'success' })
    confirmUuid.value = null
    emit('removed')
  }
  catch (caught) {
    toast.add({
      title: apiErrorMessage(caught, 'We could not remove that block.'),
      color: 'error',
    })
  }
  finally {
    removingUuid.value = null
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="title"
    description="Rentals and blocked kits on this day."
  >
    <template #body>
      <div class="space-y-6">
        <section>
          <h3 class="text-sm font-medium text-stone-900">
            Rentals
          </h3>
          <ul
            v-if="items.length"
            class="mt-3 space-y-3"
          >
            <li
              v-for="item in items"
              :key="item.uuid"
              class="rounded-lg border border-stone-200 px-3 py-3"
            >
              <NuxtLink
                :to="`/admin/rentals/${item.code}`"
                class="block"
              >
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <p class="font-medium text-stone-900">
                    {{ item.productName }}
                  </p>
                  <StatusBadge :status="item.status" />
                </div>
                <p class="mt-1 text-sm text-stone-500">
                  {{ item.code }}
                  <template v-if="item.customerName">
                    · {{ item.customerName }}
                  </template>
                </p>
                <p class="mt-1 text-sm text-stone-500">
                  {{ rangeLabel(item.startsOn, item.endsOn) }}
                </p>
                <p class="mt-2 text-xs font-medium text-lumen-800">
                  View rental
                </p>
              </NuxtLink>
            </li>
          </ul>
          <p
            v-else
            class="mt-2 text-sm text-stone-500"
          >
            No rentals on this day.
          </p>
        </section>

        <section>
          <h3 class="text-sm font-medium text-stone-900">
            Blocked kits
          </h3>
          <ul
            v-if="blocks.length"
            class="mt-3 space-y-3"
          >
            <li
              v-for="block in blocks"
              :key="block.uuid"
              class="rounded-lg border border-stone-200 px-3 py-3"
            >
              <p class="font-medium text-stone-900">
                {{ block.productName }}
              </p>
              <p class="mt-1 text-sm text-stone-500">
                {{ rangeLabel(block.startsOn, block.endsOn) }}
                <template v-if="block.reason">
                  · {{ block.reason }}
                </template>
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <template v-if="confirmUuid === block.uuid">
                  <UButton
                    color="error"
                    size="xs"
                    :loading="removingUuid === block.uuid"
                    @click="removeBlock(block.uuid)"
                  >
                    Confirm remove
                  </UButton>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :disabled="Boolean(removingUuid)"
                    @click="confirmUuid = null"
                  >
                    Cancel
                  </UButton>
                </template>
                <UButton
                  v-else
                  color="error"
                  variant="ghost"
                  size="xs"
                  @click="confirmUuid = block.uuid"
                >
                  Remove block
                </UButton>
              </div>
            </li>
          </ul>
          <p
            v-else
            class="mt-2 text-sm text-stone-500"
          >
            No kits are blocked on this day.
          </p>
        </section>

        <UButton
          v-if="canBlock"
          block
          @click="emit('block', date)"
        >
          Use this day to block
        </UButton>
      </div>
    </template>
  </USlideover>
</template>
