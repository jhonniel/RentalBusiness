<script setup lang="ts">
import type { PublicPayment } from '~/types/payment'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const { formatMoney } = useCurrency()
const toast = useToast()
const paymentUuid = computed(() => typeof route.query.payment === 'string' ? route.query.payment : '')
const returnTo = computed(() => typeof route.query.return === 'string' ? route.query.return : '/my-rentals')
const pending = ref(false)
const formError = ref('')

const { data: payment, error, refresh } = await useFetch<PublicPayment>(
  () => `/api/payments/${paymentUuid.value}`,
  { immediate: Boolean(paymentUuid.value) },
)

useSiteMeta({
  title: 'Sandbox checkout',
  path: '/payments/sandbox',
})

async function complete(outcome: 'paid' | 'failed') {
  if (!payment.value) {
    return
  }

  formError.value = ''
  pending.value = true
  try {
    await $fetch('/api/payments/sandbox/complete', {
      method: 'POST',
      body: {
        paymentUuid: payment.value.uuid,
        outcome,
      },
    })
    toast.add({
      title: outcome === 'paid' ? 'Payment recorded' : 'Payment failed',
      color: outcome === 'paid' ? 'success' : 'error',
    })
    await refresh()
    if (outcome === 'paid') {
      await navigateTo(returnTo.value)
    }
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not complete that sandbox payment.'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-lg px-4 py-10 sm:px-6">
    <h1 class="font-display text-4xl text-stone-900">
      Sandbox checkout
    </h1>
    <p class="mt-2 text-stone-600">
      This page stands in for a payment provider. It is only available when the configured provider is sandbox.
    </p>

    <CatalogNotice
      v-if="!paymentUuid || error?.statusCode === 404"
      class="mt-8"
      title="Payment not found"
      description="Start checkout from a rental that has a signed waiver."
    />

    <CatalogNotice
      v-else-if="error?.statusCode === 503"
      class="mt-8"
      title="Payments are not connected"
      description="Add live Supabase credentials to complete sandbox checkout."
    />

    <div
      v-else-if="payment"
      class="mt-8 space-y-6"
    >
      <AuthAlert
        v-if="formError"
        :description="formError"
      />

      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <p class="text-sm text-stone-500">
          Amount
        </p>
        <p class="mt-2 text-3xl text-stone-900">
          {{ formatMoney(payment.amount) }}
        </p>
        <p class="mt-3 text-sm text-stone-600">
          Status: {{ payment.status.replaceAll('_', ' ') }}
        </p>
      </section>

      <div
        v-if="['pending', 'processing'].includes(payment.status)"
        class="flex flex-wrap gap-2"
      >
        <UButton
          :loading="pending"
          @click="complete('paid')"
        >
          Simulate paid
        </UButton>
        <UButton
          color="error"
          variant="outline"
          :loading="pending"
          @click="complete('failed')"
        >
          Simulate failed
        </UButton>
      </div>

      <UButton
        v-else
        :to="returnTo"
      >
        Return to rental
      </UButton>
    </div>
  </section>
</template>
