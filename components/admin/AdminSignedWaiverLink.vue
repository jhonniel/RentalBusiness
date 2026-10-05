<script setup lang="ts">
import { adminSignedWaiverPath } from '~/utils/waiver'

const props = defineProps<{
  rentalUuid: string
}>()

const waiverPath = computed(() => adminSignedWaiverPath(props.rentalUuid))
</script>

<template>
  <div class="space-y-2">
    <p class="text-sm text-stone-500">
      Only an administrator can open the signed PDF.
    </p>
    <UButton
      :to="waiverPath"
      color="neutral"
      variant="outline"
    >
      View signed waiver
    </UButton>
  </div>
</template>
