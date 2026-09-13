<script setup lang="ts">
import type { PublicRecurringExpense } from '~/types/expense'
import { recurringExpenseInputSchema } from '~/utils/expense-validation'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Add recurring expense',
  path: '/admin/expenses/recurring/new',
})

const toast = useToast()
const saving = ref(false)
const formError = ref('')

async function onSubmit(payload: Record<string, unknown>) {
  formError.value = ''
  const parsed = recurringExpenseInputSchema.safeParse(payload)
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message || 'Check the recurring expense details.'
    return
  }

  saving.value = true
  try {
    const item = await $fetch<PublicRecurringExpense>('/api/admin/recurring-expenses', {
      method: 'POST',
      body: parsed.data,
    })
    toast.add({ title: 'Recurring expense saved', color: 'success' })
    await navigateTo(`/admin/expenses/recurring/${item.uuid}`)
  }
  catch (error) {
    const payloadError = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payloadError?.message || 'We could not save that recurring expense.'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <div>
      <UButton
        to="/admin/expenses/recurring"
        color="neutral"
        variant="ghost"
        class="-ml-2"
      >
        Back to recurring expenses
      </UButton>
      <h2 class="mt-3 text-2xl font-medium text-stone-900">
        Add recurring expense
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Save the template now. Post the next due date when the cost is incurred.
      </p>
    </div>

    <RecurringExpenseEditor
      :loading="saving"
      :error="formError"
      submit-label="Save recurring expense"
      @submit="onSubmit"
    />
  </div>
</template>
