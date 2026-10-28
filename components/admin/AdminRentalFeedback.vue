<script setup lang="ts">
import FeedbackStarRating from '~/components/feedback/FeedbackStarRating.vue'
import type { PublicRental } from '~/types/rental'
import type { AdminRentalFeedback, SentFeedbackLink } from '~/types/feedback'
import { formatBusinessDateTime } from '~/utils/datetime'
import { FEEDBACK_LINK_DAYS, FEEDBACK_RATING_LABELS } from '~/utils/feedback'

const props = defineProps<{
  rental: PublicRental
}>()

const toast = useToast()
const { data: feedback, refresh, pending } = useFetch<AdminRentalFeedback>(
  () => `/api/admin/rentals/${props.rental.uuid}/feedback`,
  { watch: [() => props.rental.status] },
)

const email = ref('')
const earnsReward = ref(true)
const sending = ref(false)
const formError = ref('')
const lastLink = ref<SentFeedbackLink | null>(null)
const showQuestions = ref(false)

function groupByProduct<T extends { product: string | null }>(items: T[]) {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const title = item.product ?? 'Overall experience'
    map.set(title, [...(map.get(title) ?? []), item])
  }
  return [...map.entries()].map(([title, entries]) => ({ title, items: entries }))
}

const answerGroups = computed(() => groupByProduct(feedback.value?.answers ?? []))
const questionGroups = computed(() => groupByProduct(feedback.value?.questions ?? []))

const statusBadge = computed(() => {
  switch (feedback.value?.status) {
    case 'submitted':
      return { label: 'Feedback received', class: 'bg-emerald-50 text-emerald-700' }
    case 'sent':
      return { label: 'Link sent', class: 'bg-sky-50 text-sky-700' }
    case 'expired':
      return { label: 'Link expired', class: 'bg-amber-50 text-amber-700' }
    default:
      return { label: 'Not sent', class: 'bg-stone-100 text-stone-600' }
  }
})

function errorMessage(error: unknown, fallback: string) {
  const payload = typeof error === 'object' && error && 'data' in error
    ? (error as { data?: { message?: string } }).data
    : null
  return payload?.message || fallback
}

async function copy(link: string) {
  try {
    await navigator.clipboard.writeText(link)
    toast.add({ title: 'Feedback link copied', color: 'success' })
  }
  catch {
    toast.add({ title: 'Could not copy the link. Select it and copy it manually.', color: 'error' })
  }
}

async function send() {
  formError.value = ''
  sending.value = true
  try {
    const result = await $fetch<SentFeedbackLink>(`/api/admin/rentals/${props.rental.uuid}/feedback`, {
      method: 'POST',
      body: { email: email.value.trim(), earnsReward: earnsReward.value },
    })
    lastLink.value = result
    toast.add({
      title: result.sent ? 'Feedback link emailed' : 'Feedback link ready',
      description: result.sent ? undefined : 'Copy the link and send it to the customer.',
      color: 'success',
    })
    await refresh()
  }
  catch (error) {
    formError.value = errorMessage(error, 'We could not create the feedback link.')
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <section
    id="feedback"
    class="scroll-mt-24 rounded-2xl border border-stone-200 bg-white p-5"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="flex items-center gap-2 text-sm font-medium text-stone-900">
        <UIcon
          name="i-lucide-star"
          class="size-4 text-stone-500"
        />
        Customer feedback
      </h3>
      <span
        class="rounded-full px-2.5 py-0.5 text-xs font-medium"
        :class="statusBadge.class"
      >
        {{ statusBadge.label }}
      </span>
    </div>

    <p
      v-if="pending && !feedback"
      class="mt-3 text-sm text-stone-500"
    >
      Loading feedback…
    </p>

    <AdminNotice
      v-else-if="feedback && !feedback.ready"
      class="mt-3"
      title="Paste the feedback SQL to turn this on"
      description="Run supabase/migrations/20261028000000_rental_feedback.sql in the Supabase SQL editor."
    />

    <template v-else-if="feedback?.status === 'submitted'">
      <div class="mt-4 flex flex-wrap items-center gap-4 rounded-xl bg-amber-50/60 p-4">
        <p class="text-4xl font-semibold tabular-nums text-stone-900">
          {{ feedback.averageRating?.toFixed(1) }}
        </p>
        <div>
          <FeedbackStarRating
            :model-value="feedback.averageRating ?? 0"
            read-only
            size="sm"
            label="Average rating"
          />
          <p class="mt-1 text-xs text-stone-600">
            Average of {{ feedback.answers.length }} questions · {{ formatBusinessDateTime(feedback.submittedAt!) }}
          </p>
        </div>
      </div>

      <div class="mt-4 space-y-4">
        <div
          v-for="group in answerGroups"
          :key="group.title"
        >
          <p class="text-xs font-semibold uppercase tracking-wider text-stone-500">
            {{ group.title }}
          </p>
          <ul class="mt-2 divide-y divide-stone-100">
            <li
              v-for="item in group.items"
              :key="item.key"
              class="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <span class="text-sm text-stone-700">{{ item.text }}</span>
              <span class="flex shrink-0 items-center gap-2">
                <FeedbackStarRating
                  :model-value="item.rating"
                  read-only
                  size="sm"
                  :label="item.text"
                />
                <span class="w-16 text-xs text-stone-500">{{ FEEDBACK_RATING_LABELS[item.rating] }}</span>
              </span>
            </li>
          </ul>
        </div>
      </div>

      <p
        v-if="feedback.reward"
        class="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
      >
        <UIcon
          name="i-lucide-ticket"
          class="size-4"
        />
        Thank-you voucher given: <span class="font-semibold tracking-wider">{{ feedback.reward.code }}</span> · {{ feedback.reward.label }}
      </p>

      <div class="mt-4 rounded-xl border border-stone-200 p-4">
        <p class="text-xs font-semibold uppercase tracking-wider text-stone-500">
          Comment
        </p>
        <p class="mt-1 whitespace-pre-line text-sm text-stone-700">
          {{ feedback.comment || 'No comment left.' }}
        </p>
      </div>
    </template>

    <template v-else-if="feedback">
      <p class="mt-3 text-sm text-stone-600">
        <template v-if="feedback.canSend">
          Send the customer a link to rate this booking from 1 to 5 stars. The questions match the equipment they rented. Only admins can create the link, and it works for {{ FEEDBACK_LINK_DAYS }} days.
        </template>
        <template v-else>
          You can send a feedback link once the booking is returned or done.
        </template>
      </p>

      <p
        v-if="feedback.status === 'sent' && feedback.sentAt"
        class="mt-2 text-xs text-stone-500"
      >
        Last link sent {{ formatBusinessDateTime(feedback.sentAt) }}{{ feedback.email ? ` to ${feedback.email}` : '' }} · works until {{ formatBusinessDateTime(feedback.expiresAt!) }} · {{ feedback.rewardEligible ? 'earns the thank-you voucher' : 'no voucher' }}
      </p>
      <p
        v-else-if="feedback.status === 'expired'"
        class="mt-2 text-xs text-amber-700"
      >
        The last link expired without an answer. Send a new one.
      </p>

      <div
        v-if="feedback.canSend"
        class="mt-4 space-y-3"
      >
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Send to a different email (optional)</span>
          <UInput
            v-model="email"
            type="email"
            class="w-full"
            placeholder="Leave blank to use the email on file"
            :disabled="sending"
          />
        </label>
        <label class="flex items-start gap-3 rounded-lg border border-stone-200 p-3 text-sm">
          <UCheckbox
            v-model="earnsReward"
            :disabled="sending"
            class="mt-0.5"
          />
          <span>
            <span class="block font-medium text-stone-900">Earns the thank-you voucher</span>
            <span class="block text-stone-600">If the customer rates every question and leaves a comment, they get the voucher set in Vouchers (while codes last). Turn off to only collect feedback.</span>
          </span>
        </label>
        <p
          v-if="formError"
          class="text-sm text-red-800"
        >
          {{ formError }}
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            :loading="sending"
            icon="i-lucide-send"
            @click="send"
          >
            {{ feedback.status === 'not_sent' ? 'Send feedback link' : 'Send a new link' }}
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            :icon="showQuestions ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            @click="showQuestions = !showQuestions"
          >
            {{ showQuestions ? 'Hide questions' : `Preview ${feedback.questions.length} questions` }}
          </UButton>
        </div>
        <p
          v-if="feedback.status === 'sent'"
          class="text-xs text-stone-500"
        >
          Sending a new link turns off the previous one.
        </p>
      </div>

      <div
        v-if="lastLink"
        class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3"
      >
        <p class="text-xs font-medium text-emerald-800">
          {{ lastLink.sent ? `Emailed to ${feedback?.email || 'the customer'}. You can also copy the link:` : 'No email was sent. Copy this link and send it to the customer:' }}
        </p>
        <div class="mt-2 flex gap-2">
          <UInput
            :model-value="lastLink.feedbackUrl"
            readonly
            class="min-w-0 flex-1"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-copy"
            @click="copy(lastLink.feedbackUrl)"
          >
            Copy
          </UButton>
        </div>
      </div>

      <div
        v-if="showQuestions"
        class="mt-4 space-y-3 rounded-xl bg-stone-50 p-4"
      >
        <div
          v-for="group in questionGroups"
          :key="group.title"
        >
          <p class="text-xs font-semibold uppercase tracking-wider text-stone-500">
            {{ group.title }}
          </p>
          <ol class="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-stone-700">
            <li
              v-for="item in group.items"
              :key="item.key"
            >
              {{ item.text }}
            </li>
          </ol>
        </div>
      </div>
    </template>
  </section>
</template>
