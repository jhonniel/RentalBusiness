<script setup lang="ts">
import type { PublicRentalHistoryEntry } from '~/types/rental'
import { formatBusinessDateTime } from '~/utils/datetime'

const COLLAPSED_COUNT = 5

const props = defineProps<{
  entries: PublicRentalHistoryEntry[]
}>()

const expanded = ref(false)
const visible = computed(() => expanded.value ? props.entries : props.entries.slice(0, COLLAPSED_COUNT))
const hiddenCount = computed(() => Math.max(0, props.entries.length - COLLAPSED_COUNT))

function statusLabel(status: string) {
  return status.replaceAll('_', ' ')
}

function statusChange(entry: PublicRentalHistoryEntry) {
  if (!entry.fromStatus) {
    return statusLabel(entry.toStatus)
  }
  return entry.fromStatus === entry.toStatus
    ? ''
    : `${statusLabel(entry.fromStatus)} → ${statusLabel(entry.toStatus)}`
}
</script>

<template>
  <section class="min-w-0 rounded-xl border border-stone-200 bg-white p-5">
    <h3 class="text-sm font-medium text-stone-900">
      Rental history
    </h3>
    <p
      v-if="!entries.length"
      class="mt-2 text-sm text-stone-600"
    >
      No changes recorded yet.
    </p>
    <ol
      v-else
      class="mt-4 space-y-4"
    >
      <li
        v-for="entry in visible"
        :key="entry.uuid"
        class="min-w-0 border-l-2 border-stone-200 pl-3"
      >
        <p class="text-sm break-words text-stone-900">
          {{ entry.note || 'Status changed.' }}
        </p>
        <p class="mt-1 text-xs break-words text-stone-500">
          {{ formatBusinessDateTime(entry.createdAt) }}
          <template v-if="entry.changedBy">
            · {{ entry.changedBy }}
          </template>
          <template v-if="statusChange(entry)">
            · <span class="capitalize">{{ statusChange(entry) }}</span>
          </template>
        </p>
      </li>
    </ol>
    <UButton
      v-if="hiddenCount"
      color="neutral"
      variant="ghost"
      size="sm"
      class="mt-3 -ml-2"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'Show fewer' : `Show ${hiddenCount} older` }}
    </UButton>
  </section>
</template>
