<script setup lang="ts">
import type { PublicFaq } from '~/types/faq'
import { APP_NAME, BUSINESS_EMAIL, FACEBOOK_MESSENGER_URL } from '~/utils/constants'
import { STARTER_FAQS } from '~/utils/faq'
import { faqPageJsonLd } from '~/utils/seo'

useSiteMeta({
  title: 'FAQs',
  description: `Answers to common questions about renting from ${APP_NAME}: booking, payments, deposits, pickup, returns, and late fees.`,
  path: '/faq',
})

const { data } = await useFetch<PublicFaq[]>('/api/faqs', {
  default: () => STARTER_FAQS,
})
const faqs = computed(() => data.value?.length ? data.value : STARTER_FAQS)

const config = useRuntimeConfig()
const origin = String(config.public.siteUrl || 'http://localhost:3000')
useHead(() => ({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify(faqPageJsonLd(origin, faqs.value)),
    },
  ],
}))

const search = ref('')
const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) {
    return faqs.value
  }
  return faqs.value.filter(faq => `${faq.question} ${faq.answer}`.toLowerCase().includes(query))
})
</script>

<template>
  <div>
    <section class="relative overflow-hidden bg-[#0f1c17] text-white">
      <div class="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-white/5 blur-2xl" />
      <div class="pointer-events-none absolute -bottom-32 -left-16 size-72 rounded-full bg-emerald-400/10 blur-3xl" />
      <div class="relative mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-8">
        <p class="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-white/75">
          <UIcon
            name="i-lucide-circle-help"
            class="size-3.5"
          />
          Help center
        </p>
        <h1 class="font-display mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
          Frequently asked questions
        </h1>
        <p class="mx-auto mt-4 max-w-xl text-base leading-7 text-white/75">
          Quick answers about booking, payments, deposits, pickup, and returns.
        </p>
        <label class="relative mx-auto mt-8 block max-w-lg">
          <span class="sr-only">Search FAQs</span>
          <UIcon
            name="i-lucide-search"
            class="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#5b6b64]"
          />
          <input
            v-model="search"
            type="search"
            class="w-full rounded-full border-0 bg-white py-3 pl-11 pr-4 text-base text-[#12201a] shadow-[0_12px_30px_rgb(0_0_0_/_20%)] placeholder:text-[#5b6b64] focus:outline-none focus:ring-2 focus:ring-emerald-300 sm:text-sm"
            placeholder="Search a question"
          >
        </label>
      </div>
    </section>

    <section class="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <p
        v-if="!filtered.length"
        class="rounded-2xl border border-dashed border-[#12201a]/15 p-8 text-center text-sm text-[#5b6b64]"
      >
        No answers match "{{ search }}". Try other words, ask the chat support, or message us on Facebook.
      </p>
      <ul
        v-else
        class="space-y-3"
      >
        <li
          v-for="faq in filtered"
          :key="faq.uuid"
        >
          <details class="group rounded-2xl border border-[#12201a]/8 bg-white transition-shadow open:shadow-[0_12px_30px_rgb(18_32_26_/_8%)]">
            <summary class="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-medium text-[#12201a] sm:px-6 [&::-webkit-details-marker]:hidden">
              {{ faq.question }}
              <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f4f6f5] text-[#12201a] transition-transform duration-200 group-open:rotate-45">
                <UIcon
                  name="i-lucide-plus"
                  class="size-4"
                />
              </span>
            </summary>
            <p class="whitespace-pre-line px-5 pb-5 text-sm leading-7 text-[#4a5a54] sm:px-6">
              {{ faq.answer }}
            </p>
          </details>
        </li>
      </ul>
    </section>

    <section class="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <div class="flex flex-col items-start justify-between gap-6 rounded-3xl bg-[#12201a] p-8 text-white sm:p-10 lg:flex-row lg:items-center">
        <div>
          <h2 class="text-2xl font-semibold tracking-tight">
            Still have a question?
          </h2>
          <p class="mt-2 text-sm text-white/70">
            Ask the chat support at the bottom right, message us on Facebook, or email
            <a
              :href="`mailto:${BUSINESS_EMAIL}`"
              class="font-medium text-white underline underline-offset-4"
            >{{ BUSINESS_EMAIL }}</a>.
          </p>
        </div>
        <div class="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row">
          <UButton
            :to="FACEBOOK_MESSENGER_URL"
            target="_blank"
            rel="noopener"
            size="lg"
            icon="i-lucide-facebook"
            class="justify-center whitespace-nowrap rounded-full bg-[#1877f2] hover:bg-[#166fe5]"
          >
            Message us on Facebook
          </UButton>
          <UButton
            to="/products"
            size="lg"
            class="justify-center whitespace-nowrap rounded-full bg-white text-[#12201a] hover:bg-white/90"
          >
            Browse equipment
          </UButton>
        </div>
      </div>
    </section>
  </div>
</template>
