<script setup lang="ts">
import type { PublicRental } from '~/types/rental'
import type { PublicRentalVoucher } from '~/types/voucher'
import { applyVoucherSchema } from '~/utils/voucher-validation'

const props = defineProps<{
  rentalUuid: string
  voucher: PublicRentalVoucher | null
  editable: boolean
}>()

const emit = defineEmits<{
  applied: [rental: PublicRental]
}>()

const toast = useToast()
const { authHeaders } = useAuth()
const code = ref('')
const pending = ref(false)
const formError = ref('')

async function applyCode() {
  formError.value = ''
  const parsed = applyVoucherSchema.safeParse({ code: code.value })
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message || 'Enter a voucher code.'
    return
  }

  pending.value = true
  try {
    const rental = await $fetch<PublicRental>(`/api/rentals/${props.rentalUuid}/voucher`, {
      method: 'POST',
      headers: authHeaders(),
      body: parsed.data,
    })
    toast.add({ title: 'Voucher applied', color: 'success' })
    code.value = ''
    emit('applied', rental)
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not apply that voucher.'
  }
  finally {
    pending.value = false
  }
}

async function removeCode() {
  formError.value = ''
  pending.value = true
  try {
    const rental = await $fetch<PublicRental>(`/api/rentals/${props.rentalUuid}/voucher`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    toast.add({ title: 'Voucher removed', color: 'success' })
    emit('applied', rental)
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not remove that voucher.'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="rounded-2xl border border-stone-200 bg-white p-5">
    <h2 class="text-sm font-medium text-stone-900">
      Voucher
    </h2>
    <p class="mt-1 text-sm text-stone-600">
      Enter a shop code to reduce the rental total. The deposit hold stays the same.
    </p>

    <p
      v-if="voucher"
      class="mt-3 text-sm text-stone-800"
    >
      Applied {{ voucher.code }} · {{ voucher.name }}
    </p>

    <AuthAlert
      v-if="formError"
      class="mt-3"
      :description="formError"
    />

    <form
      v-if="editable"
      class="mt-4 flex flex-col gap-3 sm:flex-row"
      @submit.prevent="applyCode"
    >
      <UInput
        v-model="code"
        class="w-full sm:flex-1"
        placeholder="JRY-XXXXXX"
        :disabled="pending"
        autocomplete="off"
      />
      <div class="flex gap-2">
        <UButton
          type="submit"
          :loading="pending"
        >
          Apply
        </UButton>
        <UButton
          v-if="voucher"
          color="neutral"
          variant="outline"
          type="button"
          :disabled="pending"
          @click="removeCode"
        >
          Remove
        </UButton>
      </div>
    </form>
  </section>
</template>
