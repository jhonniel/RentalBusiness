<script setup lang="ts">
import FeedbackStarRating from '~/components/feedback/FeedbackStarRating.vue'
import type { PublicFeedbackForm } from '~/types/feedback'
import type { FeedbackRewardVoucher } from '~/utils/feedback-reward'
import { formatBusinessDate, formatBookingDateRange } from '~/utils/datetime'
import { FEEDBACK_RATING_LABELS } from '~/utils/feedback'
import { submitFeedbackSchema } from '~/utils/feedback-validation'

definePageMeta({
  layout: 'blank',
})

useSiteMeta({
  title: 'Rate your rental',
  path: '/feedback',
  robots: 'noindex, nofollow',
})

const route = useRoute()
const uuid = computed(() => String(route.params.uuid || ''))
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '')

const { data: form, error, refresh: reloadForm } = await useFetch<PublicFeedbackForm>(() => `/api/feedback/${uuid.value}`, {
  query: { token },
  immediate: token.value.length >= 20,
})

const invalid = computed(() => token.value.length < 20 || Boolean(error.value))
const ratings = reactive<Record<string, number>>({})
const comment = ref('')
const pending = ref(false)
const formError = ref('')
const done = ref(false)
const average = ref<number | null>(null)
const reward = ref<FeedbackRewardVoucher | null>(null)
const toast = useToast()
const { formatMoney } = useCurrency()
const shownReward = computed(() => reward.value ?? form.value?.reward ?? null)
const offer = computed(() => form.value?.rewardOffer ?? null)
const commentForReward = computed(() => offer.value ? Math.max(0, offer.value.minCommentLength - comment.value.trim().length) : 0)

async function copyReward() {
  if (!shownReward.value) {
    return
  }
  try {
    await navigator.clipboard.writeText(shownReward.value.code)
    toast.add({ title: 'Voucher code copied', color: 'success' })
  }
  catch {
    toast.add({ title: 'Select the code and copy it.', color: 'error' })
  }
}

const groups = computed(() => {
  const map = new Map<string, PublicFeedbackForm['questions']>()
  for (const question of form.value?.questions ?? []) {
    const title = question.product ?? 'Your overall experience'
    map.set(title, [...(map.get(title) ?? []), question])
  }
  return [...map.entries()].map(([title, questions]) => ({ title, questions }))
})
const total = computed(() => form.value?.questions.length ?? 0)
const answered = computed(() => (form.value?.questions ?? []).filter(question => ratings[question.key]).length)
const ready = computed(() => total.value > 0 && answered.value === total.value)

async function submit() {
  if (pending.value || done.value || form.value?.submitted) {
    return
  }
  formError.value = ''
  const parsed = submitFeedbackSchema.safeParse({
    token: token.value,
    answers: (form.value?.questions ?? []).map(question => ({ key: question.key, rating: ratings[question.key] ?? 0 })),
    comment: comment.value,
  })
  if (!parsed.success || !ready.value) {
    formError.value = ready.value
      ? parsed.error?.issues[0]?.message || 'Check your answers.'
      : 'Rate every question from 1 to 5 stars.'
    return
  }

  pending.value = true
  try {
    const result = await $fetch<{ submitted: boolean, averageRating: number, reward: FeedbackRewardVoucher | null }>(`/api/feedback/${uuid.value}`, {
      method: 'POST',
      body: parsed.data,
    })
    average.value = result.averageRating
    reward.value = result.reward
    done.value = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  catch (caught) {
    const status = typeof caught === 'object' && caught && 'statusCode' in caught
      ? (caught as { statusCode?: number }).statusCode
      : undefined
    if (status === 409 && form.value) {
      await reloadForm()
      form.value = form.value ? { ...form.value, submitted: true } : form.value
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const payload = typeof caught === 'object' && caught && 'data' in caught
      ? (caught as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not send your feedback. Please try again.'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="min-h-dvh bg-[#f3f5f4] text-[#12201a]">
    <header class="border-b border-[#12201a]/10 bg-white">
      <div class="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <AppLogo />
        <p class="text-[11px] font-medium tracking-wide text-[#5b6b64] sm:text-xs">
          Takes about a minute
        </p>
      </div>
    </header>

    <main class="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-12">
      <CatalogNotice
        v-if="invalid"
        title="This feedback link is invalid"
        description="Please ask JRY Rentals to send you a new feedback link."
      />

      <section
        v-else-if="done || form?.submitted"
        class="rounded-3xl border border-[#12201a]/8 bg-white p-8 text-center shadow-[0_18px_50px_rgb(18_32_26_/_8%)] sm:p-12"
      >
        <span class="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <UIcon
            name="i-lucide-heart-handshake"
            class="size-7"
          />
        </span>
        <h1 class="font-display mt-5 text-3xl font-semibold tracking-tight">
          Thank you{{ form?.customerFirstName ? `, ${form.customerFirstName}` : '' }}!
        </h1>
        <p class="mx-auto mt-3 max-w-md text-sm leading-7 text-[#4a5a54]">
          {{ done ? 'Your feedback was sent. It helps us keep our equipment and service at their best.' : 'You already sent feedback for this booking. We appreciate it.' }}
        </p>
        <div
          v-if="average"
          class="mt-6 flex flex-col items-center gap-1"
        >
          <FeedbackStarRating
            :model-value="average"
            read-only
            size="md"
            label="Your average rating"
          />
          <p class="text-xs text-[#5b6b64]">
            Your average: {{ average.toFixed(1) }} of 5
          </p>
        </div>
        <div
          v-if="shownReward"
          class="mx-auto mt-8 max-w-sm rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 p-5"
        >
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
            Your thank-you voucher
          </p>
          <p class="mt-1 text-sm text-emerald-900">
            {{ shownReward.label }}
          </p>
          <div class="mt-3 flex items-center justify-center gap-2">
            <span class="select-all rounded-lg bg-white px-4 py-2 font-mono text-xl font-bold tracking-[0.2em] text-[#12201a] shadow-sm">{{ shownReward.code }}</span>
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-copy"
              aria-label="Copy voucher code"
              @click="copyReward"
            />
          </div>
          <p
            v-if="shownReward.endsOn"
            class="mt-3 text-sm font-medium text-emerald-900"
          >
            Valid until {{ formatBusinessDate(shownReward.endsOn) }}
          </p>
          <p class="mt-2 text-xs leading-5 text-emerald-900/80">
            This code is only for you and works once. Enter it on Request a rental before you pay.<template v-if="shownReward.minSubtotal > 0">
              For rentals of {{ formatMoney(shownReward.minSubtotal) }} or more.
            </template>
          </p>
          <p class="mt-4 flex items-start gap-2 rounded-xl bg-white/80 px-3 py-2.5 text-left text-xs font-medium leading-5 text-[#12201a]">
            <UIcon
              name="i-lucide-camera"
              class="mt-0.5 size-4 shrink-0 text-emerald-700"
            />
            Save this code or take a screenshot of this screen so you can use it on your next rental.
          </p>
        </div>
        <UButton
          to="/products"
          class="mt-8 justify-center rounded-full"
          size="lg"
        >
          {{ shownReward ? 'Book your next rental' : 'Browse equipment' }}
        </UButton>
      </section>

      <CatalogNotice
        v-else-if="form?.expired"
        title="This feedback link has expired"
        description="Message JRY Rentals on Facebook if you would still like to share your feedback."
      />

      <template v-else-if="form">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6b64]">
          Booking {{ form.rentalCode }}
        </p>
        <h1 class="font-display mt-3 text-[1.75rem] leading-tight sm:text-4xl">
          How was your rental{{ form.customerFirstName ? `, ${form.customerFirstName}` : '' }}?
        </h1>
        <p class="mt-3 text-sm leading-7 text-[#4a5a54]">
          Rate each question from 1 to 5 stars about {{ form.products.join(', ') || 'your rental' }}
          ({{ formatBookingDateRange(form.startsOn, form.endsOn) }}). You can also leave a comment.
        </p>

        <div
          v-if="offer"
          class="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          <UIcon
            name="i-lucide-gift"
            class="mt-0.5 size-5 shrink-0"
          />
          <p>
            <span class="font-semibold">Get {{ offer.label }}.</span>
            Rate every question and leave a short comment, and we will give you a voucher code right away.
          </p>
        </div>

        <form
          class="mt-8 space-y-5"
          @submit.prevent="submit"
        >
          <section
            v-for="group in groups"
            :key="group.title"
            class="rounded-2xl border border-[#12201a]/8 bg-white p-5 sm:p-6"
          >
            <h2 class="flex items-center gap-2 font-semibold">
              <UIcon
                :name="group.title === 'Your overall experience' ? 'i-lucide-smile' : 'i-lucide-package'"
                class="size-4 text-[#5b6b64]"
              />
              {{ group.title }}
            </h2>
            <ul class="mt-4 divide-y divide-[#12201a]/6">
              <li
                v-for="question in group.questions"
                :key="question.key"
                class="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <p class="text-sm leading-6 text-[#3b4a44]">
                  {{ question.text }}
                </p>
                <div class="flex shrink-0 items-center gap-2">
                  <FeedbackStarRating
                    v-model="ratings[question.key]"
                    :label="question.text"
                    :read-only="pending"
                  />
                  <span class="w-16 text-xs font-medium text-[#5b6b64]">
                    {{ ratings[question.key] ? FEEDBACK_RATING_LABELS[ratings[question.key]!] : '' }}
                  </span>
                </div>
              </li>
            </ul>
          </section>

          <section class="rounded-2xl border border-[#12201a]/8 bg-white p-5 sm:p-6">
            <label
              for="feedback-comment"
              class="font-semibold"
            >
              Anything else you want to tell us? <span class="font-normal text-[#5b6b64]">{{ offer ? '(needed for your voucher)' : '(optional)' }}</span>
            </label>
            <UTextarea
              id="feedback-comment"
              v-model="comment"
              class="mt-3 w-full"
              :rows="4"
              autoresize
              maxlength="2000"
              placeholder="What did you like? What could we do better?"
              :disabled="pending"
            />
            <div class="mt-1 flex items-center justify-between gap-3 text-xs">
              <span
                v-if="offer"
                :class="commentForReward ? 'text-[#5b6b64]' : 'font-medium text-emerald-700'"
              >
                {{ commentForReward ? `Write ${commentForReward} more character${commentForReward === 1 ? '' : 's'} to get your voucher.` : 'Your comment qualifies for the voucher.' }}
              </span>
              <span
                v-else
                aria-hidden="true"
              />
              <span class="text-[#5b6b64]">{{ comment.length }} / 2000</span>
            </div>
          </section>

          <AuthAlert
            v-if="formError"
            :description="formError"
          />

          <div class="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-[#12201a]/8 bg-[#f3f5f4]/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
            <UButton
              type="submit"
              size="lg"
              class="justify-center rounded-full"
              :loading="pending"
              :disabled="!ready"
            >
              Send feedback
            </UButton>
          </div>
        </form>
      </template>
    </main>
  </div>
</template>
