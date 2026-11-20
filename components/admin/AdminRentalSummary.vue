<script setup lang="ts">
import type { RentalPaymentChange, RentalQuote } from '~/types/rental'

const props = defineProps<{
  quote: RentalQuote & { commissionAmount?: number, paymentChange?: RentalPaymentChange | null }
  showCommission?: boolean
}>()

const { formatMoney } = useCurrency()
const amountDue = computed(() => props.quote.totalAmount + props.quote.depositAmount)
const payment = computed(() => props.quote.paymentChange ?? null)
/** The held deposit is not rent, so a deposit that changes is shown on its own line. */
const depositChange = computed(() => payment.value
  ? Math.round((payment.value.newAmount - payment.value.paidAmount - payment.value.balanceDue + payment.value.refundDue) * 100) / 100
  : 0)
</script>

<template>
  <section class="rounded-xl border border-stone-200 bg-white p-5">
    <h3 class="text-sm font-medium text-stone-900">
      Summary
    </h3>
    <dl class="mt-4 space-y-2 text-sm">
      <div class="flex justify-between gap-4">
        <dt class="text-stone-500">
          <template v-if="quote.billingUnit === 'hour'">{{ quote.hours }} hour{{ quote.hours === 1 ? '' : 's' }}</template>
          <template v-else>{{ quote.days }} day{{ quote.days === 1 ? '' : 's' }}</template>
        </dt>
        <dd>{{ formatMoney(quote.rentAmount) }}</dd>
      </div>
      <div
        v-if="quote.lessAmount > 0"
        class="flex justify-between gap-4"
      >
        <dt class="text-stone-500">
          Less
        </dt>
        <dd>−{{ formatMoney(quote.lessAmount) }}</dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="text-stone-500">
          Deposit
        </dt>
        <dd>{{ formatMoney(quote.depositAmount) }}</dd>
      </div>
      <div class="flex justify-between gap-4 font-medium text-stone-900">
        <dt>Amount due</dt>
        <dd>{{ formatMoney(amountDue) }}</dd>
      </div>
      <div
        v-if="showCommission"
        class="flex justify-between gap-4"
      >
        <dt class="text-stone-500">
          Commissioner commission
        </dt>
        <dd>{{ formatMoney(quote.commissionAmount || 0) }}</dd>
      </div>
      <template v-if="payment">
        <div class="flex justify-between gap-4 border-t border-stone-100 pt-3">
          <dt class="text-stone-500">
            Already paid
          </dt>
          <dd>{{ formatMoney(payment.paidAmount) }}</dd>
        </div>
        <div
          v-if="payment.newAmount !== amountDue"
          class="flex justify-between gap-4"
        >
          <dt class="text-stone-500">
            New payment total
          </dt>
          <dd>{{ formatMoney(payment.newAmount) }}</dd>
        </div>
        <div
          v-if="depositChange !== 0"
          class="flex justify-between gap-4"
        >
          <dt class="text-stone-500">
            {{ depositChange > 0 ? 'Deposit to add' : 'Deposit to return' }}
          </dt>
          <dd>{{ formatMoney(Math.abs(depositChange)) }}</dd>
        </div>
        <div
          v-if="payment.balanceDue > 0"
          class="flex justify-between gap-4 font-medium text-amber-800"
        >
          <dt>Balance unpaid</dt>
          <dd>{{ formatMoney(payment.balanceDue) }}</dd>
        </div>
        <div
          v-else-if="payment.refundDue > 0"
          class="flex justify-between gap-4 font-medium text-sky-800"
        >
          <dt>To refund</dt>
          <dd>{{ formatMoney(payment.refundDue) }}</dd>
        </div>
        <div
          v-else
          class="flex justify-between gap-4 text-stone-500"
        >
          <dt>Balance or refund</dt>
          <dd>None</dd>
        </div>
      </template>
    </dl>
    <p
      v-if="payment && (payment.balanceDue > 0 || payment.refundDue > 0)"
      class="mt-3 text-xs text-stone-500"
    >
      {{ payment.balanceDue > 0
        ? 'This stays on the booking as an unpaid balance until you mark it paid. Sales count it on that day.'
        : 'This stays on the booking as an amount to refund until you mark it refunded. Sales drop on that day.' }}
    </p>
    <p
      class="mt-4 text-sm"
      :class="quote.canFulfill ? 'text-lumen-800' : 'text-red-800'"
    >
      {{ quote.canFulfill
        ? `${quote.available} units are free for these dates.`
        : 'That quantity is not available for these dates.' }}
    </p>
  </section>
</template>
