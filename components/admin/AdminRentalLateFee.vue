<script setup lang="ts">
import type { PublicRental } from '~/types/rental'
import type { LateFeeType } from '~/utils/late-fee'
import { formatBusinessDateTime } from '~/utils/datetime'
import {
  LATE_FEE_TYPE_HINTS,
  LATE_FEE_TYPE_LABELS,
  LATE_FEE_TYPES,
  canChangeLateFee,
  canPayLateFee,
  canVoidLateFee,
} from '~/utils/late-fee'
import { paymentMethodLabel } from '~/utils/report'
import { SHOP_PAYMENT_METHODS } from '~/utils/rental'

const props = defineProps<{
  rental: PublicRental
}>()

const emit = defineEmits<{
  changed: []
}>()

const toast = useToast()
const { formatMoney } = useCurrency()
const fee = computed(() => props.rental.lateFee ?? null)

const type = ref<LateFeeType>('schedule')
const customAmount = ref<number | string>('')
const voidReason = ref('')
const confirmVoid = ref(false)
const payMethod = ref<(typeof SHOP_PAYMENT_METHODS)[number]>('cash')
const busy = ref<'' | 'type' | 'void' | 'restore' | 'paid'>('')
const formError = ref('')

watch(fee, (value) => {
  type.value = value?.type ?? 'schedule'
  customAmount.value = value?.customAmount ?? ''
}, { immediate: true })

const typeChanged = computed(() => Boolean(fee.value) && (
  type.value !== fee.value!.type
  || (type.value === 'custom' && Number(customAmount.value || 0) !== (fee.value!.customAmount ?? 0))
))

const statusBadge = computed(() => {
  switch (fee.value?.status) {
    case 'accruing':
      return { label: 'Adding up', class: 'bg-red-50 text-red-700' }
    case 'due':
      return { label: 'Unpaid', class: 'bg-amber-50 text-amber-700' }
    case 'paid':
      return { label: 'Paid', class: 'bg-emerald-50 text-emerald-700' }
    case 'void':
      return { label: 'Void', class: 'bg-stone-100 text-stone-600' }
    default:
      return { label: 'No late fee', class: 'bg-stone-100 text-stone-600' }
  }
})

function lateLabel(hours: number) {
  if (hours <= 0) {
    return 'Not late'
  }
  if (hours < 24) {
    const whole = Math.floor(hours)
    const minutes = Math.round((hours - whole) * 60)
    return `${whole}h ${minutes}m late`
  }
  const days = Math.floor(hours / 24)
  const rest = Math.round(hours - days * 24)
  return `${days} day${days === 1 ? '' : 's'}${rest ? ` ${rest}h` : ''} late`
}

function errorMessage(error: unknown, fallback: string) {
  const payload = typeof error === 'object' && error && 'data' in error
    ? (error as { data?: { message?: string } }).data
    : null
  return payload?.message || fallback
}

async function run(kind: typeof busy.value, request: () => Promise<unknown>, success: string) {
  formError.value = ''
  busy.value = kind
  try {
    await request()
    toast.add({ title: success, color: 'success' })
    confirmVoid.value = false
    voidReason.value = ''
    emit('changed')
  }
  catch (error) {
    formError.value = errorMessage(error, 'We could not update the late fee.')
  }
  finally {
    busy.value = ''
  }
}

function saveType() {
  const body = type.value === 'custom'
    ? { type: type.value, customAmount: Number(customAmount.value || 0) }
    : { type: type.value }
  return run('type', () => $fetch(`/api/admin/rentals/${props.rental.uuid}/late-fee`, { method: 'PATCH', body }), 'Late fee type saved')
}

function voidFee() {
  return run('void', () => $fetch(`/api/admin/rentals/${props.rental.uuid}/late-fee/void`, {
    method: 'POST',
    body: { reason: voidReason.value },
  }), 'Late fee voided')
}

function restoreFee() {
  return run('restore', () => $fetch(`/api/admin/rentals/${props.rental.uuid}/late-fee/restore`, { method: 'POST' }), 'Late fee restored')
}

function markPaid() {
  return run('paid', () => $fetch(`/api/admin/rentals/${props.rental.uuid}/late-fee/paid`, {
    method: 'POST',
    body: { paymentMethod: payMethod.value },
  }), 'Late fee payment recorded')
}
</script>

<template>
  <section
    v-if="fee"
    class="rounded-xl border bg-white p-5"
    :class="fee.status === 'accruing' ? 'border-red-200' : 'border-stone-200'"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-medium text-stone-900">
          Late fee
        </h3>
        <p class="mt-1 text-xs text-stone-500">
          Applies on its own when the equipment is not marked returned by {{ formatBusinessDateTime(fee.returnAt) }}.
          It stops adding up when you mark the rental done or record the payment.
        </p>
      </div>
      <span
        class="rounded-full px-2.5 py-0.5 text-xs font-medium"
        :class="statusBadge.class"
      >
        {{ statusBadge.label }}
      </span>
    </div>

    <AdminNotice
      v-if="!fee.available"
      class="mt-4"
      title="Late fees are not turned on yet"
      description="Paste supabase/migrations/20261024000000_rental_late_fees.sql in the Supabase SQL editor."
    />

    <template v-else>
      <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div class="rounded-lg bg-stone-50 px-3 py-2">
          <dt class="text-xs text-stone-500">
            Late by
          </dt>
          <dd class="mt-0.5 font-medium text-stone-900">
            {{ lateLabel(fee.hoursLate) }}
          </dd>
        </div>
        <div class="rounded-lg bg-stone-50 px-3 py-2">
          <dt class="text-xs text-stone-500">
            Late fee
          </dt>
          <dd
            class="mt-0.5 font-medium"
            :class="fee.status === 'void' ? 'text-stone-400 line-through' : 'text-stone-900'"
          >
            {{ formatMoney(fee.amount) }}
          </dd>
        </div>
        <div class="rounded-lg bg-stone-50 px-3 py-2">
          <dt class="text-xs text-stone-500">
            Type
          </dt>
          <dd class="mt-0.5 font-medium text-stone-900">
            {{ LATE_FEE_TYPE_LABELS[fee.type] }}
          </dd>
        </div>
      </dl>
      <p class="mt-2 text-xs text-stone-500">
        Daily rent used: {{ formatMoney(fee.dailyRent) }}
        <template v-if="fee.status === 'accruing'">
          · as of {{ formatBusinessDateTime(fee.asOf) }}
        </template>
        <template v-if="fee.paidAt">
          · paid {{ formatBusinessDateTime(fee.paidAt) }}
        </template>
        <template v-if="fee.voidedAt">
          · voided {{ formatBusinessDateTime(fee.voidedAt) }}<template v-if="fee.voidReason">
            ({{ fee.voidReason }})
          </template>
        </template>
      </p>

      <AuthAlert
        v-if="formError"
        class="mt-4"
        :description="formError"
      />

      <form
        v-if="canChangeLateFee(fee.status)"
        class="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
        @submit.prevent="saveType"
      >
        <label class="block text-sm">
          <span class="mb-1 block text-xs font-medium text-stone-600">Late fee type</span>
          <select
            v-model="type"
            class="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
            :disabled="Boolean(busy)"
          >
            <option
              v-for="item in LATE_FEE_TYPES"
              :key="item"
              :value="item"
            >
              {{ LATE_FEE_TYPE_LABELS[item] }}
            </option>
          </select>
        </label>
        <label
          v-if="type === 'custom'"
          class="block text-sm"
        >
          <span class="mb-1 block text-xs font-medium text-stone-600">Amount (₱)</span>
          <UInput
            v-model="customAmount"
            type="number"
            min="0"
            step="0.01"
            :disabled="Boolean(busy)"
          />
        </label>
        <span
          v-else
          class="hidden sm:block"
        />
        <UButton
          type="submit"
          color="neutral"
          variant="outline"
          :loading="busy === 'type'"
          :disabled="!typeChanged || Boolean(busy)"
        >
          Save type
        </UButton>
        <p class="text-xs text-stone-500 sm:col-span-3">
          {{ LATE_FEE_TYPE_HINTS[type] }}
        </p>
      </form>

      <div
        v-if="canPayLateFee(fee.status) || canVoidLateFee(fee.status) || fee.status === 'void'"
        class="mt-4 flex flex-wrap items-end gap-2 border-t border-stone-100 pt-4"
      >
        <template v-if="canPayLateFee(fee.status)">
          <label class="block text-sm">
            <span class="mb-1 block text-xs font-medium text-stone-600">Paid with</span>
            <select
              v-model="payMethod"
              class="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
              :disabled="Boolean(busy)"
            >
              <option
                v-for="method in SHOP_PAYMENT_METHODS"
                :key="method"
                :value="method"
              >
                {{ paymentMethodLabel(method) }}
              </option>
            </select>
          </label>
          <UButton
            :loading="busy === 'paid'"
            :disabled="Boolean(busy)"
            @click="markPaid"
          >
            Mark {{ formatMoney(fee.amount) }} paid
          </UButton>
        </template>

        <template v-if="canVoidLateFee(fee.status)">
          <template v-if="confirmVoid">
            <label class="block min-w-48 flex-1 text-sm">
              <span class="mb-1 block text-xs font-medium text-stone-600">Reason (optional)</span>
              <UInput
                v-model="voidReason"
                maxlength="500"
                placeholder="Customer called ahead, waived"
                :disabled="Boolean(busy)"
              />
            </label>
            <UButton
              color="error"
              :loading="busy === 'void'"
              :disabled="Boolean(busy)"
              @click="voidFee"
            >
              Confirm void
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              :disabled="Boolean(busy)"
              @click="confirmVoid = false"
            >
              Keep fee
            </UButton>
          </template>
          <UButton
            v-else
            color="error"
            variant="ghost"
            :disabled="Boolean(busy)"
            @click="confirmVoid = true"
          >
            Void late fee
          </UButton>
        </template>

        <UButton
          v-if="fee.status === 'void'"
          color="neutral"
          variant="outline"
          :loading="busy === 'restore'"
          :disabled="Boolean(busy)"
          @click="restoreFee"
        >
          Restore late fee
        </UButton>
      </div>
    </template>
  </section>
</template>
