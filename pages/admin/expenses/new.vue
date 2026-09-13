<script setup lang="ts">
import type { PublicExpense } from '~/types/expense'
import { expenseInputSchema } from '~/utils/expense-validation'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Add expense',
  path: '/admin/expenses/new',
})

const toast = useToast()
const saving = ref(false)
const formError = ref('')

async function onSubmit(payload: Record<string, unknown>) {
  formError.value = ''
  const parsed = expenseInputSchema.safeParse(payload)
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message || 'Check the expense details.'
    return
  }

  saving.value = true
  try {
    const expense = await $fetch<PublicExpense>('/api/admin/expenses', {
      method: 'POST',
      body: parsed.data,
    })
    toast.add({ title: 'Expense saved', color: 'success' })
    await navigateTo(`/admin/expenses/${expense.uuid}`)
  }
  catch (error) {
    const payloadError = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payloadError?.message || 'We could not save that expense.'
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
        to="/admin/expenses"
        color="neutral"
        variant="ghost"
        class="-ml-2"
      >
        Back to expenses
      </UButton>
      <h2 class="mt-3 text-2xl font-medium text-stone-900">
        Add expense
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Record a one-time cost. Amounts are stored in PHP.
      </p>
    </div>

    <ExpenseEditor
      :loading="saving"
      :error="formError"
      submit-label="Save expense"
      @submit="onSubmit"
    />
  </div>
</template>
