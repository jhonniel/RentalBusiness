<script setup lang="ts">
import type { PublicRental } from '~/types/rental'
import { SHOP_PAYMENT_METHODS } from '~/utils/rental'

const props = defineProps<{
  rental: Pick<PublicRental, 'uuid' | 'paymentBalance'>
}>()

const emit = defineEmits<{
  changed: []
}>()

const toast = useToast()
const { formatMoney } = useCurrency()
const method = ref<(typeof SHOP_PAYMENT_METHODS)[number]>('cash')
const saving = ref(false)
const balance = computed(() => props.rental.paymentBalance ?? null)
const owed = computed(() => balance.value?.balanceDue ?? 0)
const refund = computed(() => balance.value?.refundDue ?? 0)

async function settle() {
  if (saving.value) {
    return
  }

  const paying = owed.value > 0
  saving.value = true
  try {
    await $fetch(`/api/admin/rentals/${props.rental.uuid}/balance/${paying ? 'paid' : 'refunded'}`, {
      method: 'POST',
      body: { paymentMethod: method.value },
    })
    toast.add({
      title: paying ? 'Balance marked paid' : 'Refund marked given',
      description: paying ? 'Sales count it today.' : 'Sales dropped by it today.',
      color: 'success',
    })
    emit('changed')
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payload?.message || (paying ? 'We could not record that payment.' : 'We could not record that refund.'),
      color: 'error',
    })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <section
    v-if="balance && (owed > 0 || refund > 0)"
    class="rounded-2xl border p-5 text-sm"
    :class="owed > 0 ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50'"
  >
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0 flex-1">
        <h3
          class="flex items-center gap-2 font-medium"
          :class="owed > 0 ? 'text-amber-900' : 'text-sky-900'"
        >
          <UIcon
            :name="owed > 0 ? 'i-lucide-circle-alert' : 'i-lucide-undo-2'"
            class="size-4"
          />
          {{ owed > 0 ? 'Balance unpaid' : 'To refund' }}
          <span class="tabular-nums">· {{ formatMoney(owed > 0 ? owed : refund) }}</span>
        </h3>
        <p
          class="mt-1"
          :class="owed > 0 ? 'text-amber-900/80' : 'text-sky-900/80'"
        >
          The amount due is now {{ formatMoney(balance.newAmount) }} and {{ formatMoney(balance.paidAmount) }} is paid.
          {{ owed > 0
            ? 'This balance is not in Sales until you mark it paid.'
            : 'This amount stays in Sales until you mark it refunded.' }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <select
          v-model="method"
          class="h-9 rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-800"
          :disabled="saving"
          :aria-label="owed > 0 ? 'Payment method' : 'Refund method'"
        >
          <option
            v-for="option in SHOP_PAYMENT_METHODS"
            :key="option"
            :value="option"
          >
            {{ option === 'gcash' ? 'GCash' : option === 'maya' ? 'Maya' : option === 'bank' ? 'Bank' : 'Cash' }}
          </option>
        </select>
        <UButton
          class="min-w-0 flex-1 justify-center sm:flex-none sm:whitespace-nowrap"
          :color="owed > 0 ? 'primary' : 'neutral'"
          :loading="saving"
          @click="settle"
        >
          {{ owed > 0 ? 'Mark balance paid' : 'Mark refunded' }} · {{ formatMoney(owed > 0 ? owed : refund) }}
        </UButton>
      </div>
    </div>
  </section>
</template>
