<script setup lang="ts">
import { APP_NAME, BUSINESS_ADDRESS, BUSINESS_EMAIL, FACEBOOK_MESSENGER_URL } from '~/utils/constants'
import { aboutPageJsonLd } from '~/utils/seo'
import { ABOUT_INTRO, ABOUT_JOURNEY, ABOUT_MISSION, ABOUT_TAGLINE, ABOUT_VALUES, ABOUT_WHO_WE_ARE } from '~/utils/site-content'

useSiteMeta({
  title: 'About',
  description: 'JRY Rentals is based in Davao City. We make renting cameras, drones, and Starlink simple, convenient, and accessible.',
  path: '/about',
})

const config = useRuntimeConfig()
const origin = String(config.public.siteUrl || 'http://localhost:3000')
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify(aboutPageJsonLd(origin)),
    },
  ],
})

const values = ABOUT_VALUES
const journey = ABOUT_JOURNEY

const policies = [
  { title: 'Terms & Conditions', copy: 'Rules for using the website and rental service.', to: '/terms', icon: 'i-lucide-file-text' },
  { title: 'Privacy Policy', copy: 'How we collect and use personal information.', to: '/privacy', icon: 'i-lucide-lock' },
  { title: 'Cookie Policy', copy: 'How cookies and similar technologies are used.', to: '/cookies', icon: 'i-lucide-cookie' },
]
</script>

<template>
  <div>
    <section class="relative overflow-hidden bg-[#0f1c17] text-white">
      <div class="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-white/5 blur-2xl" />
      <div class="pointer-events-none absolute -bottom-32 -left-16 size-72 rounded-full bg-emerald-400/10 blur-3xl" />
      <div class="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <p class="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-white/75">
          <UIcon
            name="i-lucide-map-pin"
            class="size-3.5"
          />
          Based in {{ BUSINESS_ADDRESS }}
        </p>
        <h1 class="font-display mt-5 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          {{ ABOUT_TAGLINE }}
        </h1>
        <p class="mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
          <strong class="font-semibold text-white">{{ APP_NAME }}</strong> {{ ABOUT_INTRO }}
        </p>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <UButton
            to="/products"
            size="lg"
            trailing-icon="i-lucide-arrow-right"
            class="justify-center rounded-full bg-white text-[#12201a] hover:bg-white/90"
          >
            Browse equipment
          </UButton>
          <UButton
            to="/#how-it-works"
            size="lg"
            color="neutral"
            variant="outline"
            class="justify-center rounded-full bg-transparent text-white ring-white/30 hover:bg-white/10"
          >
            How it works
          </UButton>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-16">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6b64]">
            Who we are
          </p>
          <h2 class="mt-3 text-2xl font-semibold tracking-tight text-[#12201a] sm:text-3xl">
            {{ ABOUT_WHO_WE_ARE.title }}
          </h2>
          <p class="mt-4 text-sm leading-7 text-[#4a5a54] sm:text-base sm:leading-8">
            {{ ABOUT_WHO_WE_ARE.body }}
          </p>
        </div>
        <ol class="grid gap-3 sm:grid-cols-2">
          <li
            v-for="(step, index) in journey"
            :key="step.title"
            class="storefront-card rounded-2xl p-5"
          >
            <div class="flex items-center justify-between">
              <span class="flex size-10 items-center justify-center rounded-xl bg-[#f4f6f5] text-[#12201a]">
                <UIcon
                  :name="step.icon"
                  class="size-5"
                />
              </span>
              <span class="text-xs font-semibold tabular-nums text-[#5b6b64]">0{{ index + 1 }}</span>
            </div>
            <h3 class="mt-4 font-semibold text-[#12201a]">
              {{ step.title }}
            </h3>
            <p class="mt-1 text-sm leading-6 text-[#4a5a54]">
              {{ step.copy }}
            </p>
          </li>
        </ol>
      </div>
    </section>

    <section class="bg-[#f4f6f5]">
      <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div class="max-w-2xl">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6b64]">
            Our values
          </p>
          <h2 class="mt-3 text-2xl font-semibold tracking-tight text-[#12201a] sm:text-3xl">
            What we stand for
          </h2>
        </div>
        <ul class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <li
            v-for="value in values"
            :key="value.title"
            class="rounded-2xl border border-[#12201a]/8 bg-white p-6 transition-shadow hover:shadow-[0_12px_30px_rgb(18_32_26_/_8%)]"
          >
            <span class="flex size-11 items-center justify-center rounded-xl bg-[#12201a] text-white">
              <UIcon
                :name="value.icon"
                class="size-5"
              />
            </span>
            <h3 class="mt-5 text-lg font-semibold text-[#12201a]">
              {{ value.title }}
            </h3>
            <p class="mt-2 text-sm leading-6 text-[#4a5a54]">
              {{ value.copy }}
            </p>
          </li>
        </ul>
      </div>
    </section>

    <section class="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
      <UIcon
        name="i-lucide-quote"
        class="mx-auto size-8 text-[#12201a]/20"
      />
      <p class="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6b64]">
        Our mission
      </p>
      <p class="mt-4 text-2xl font-semibold leading-snug tracking-tight text-[#12201a] sm:text-3xl">
        {{ ABOUT_MISSION.statement }}
      </p>
      <p class="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#4a5a54] sm:text-base sm:leading-8">
        {{ ABOUT_MISSION.body }}
        <strong class="font-semibold text-[#12201a]">{{ ABOUT_MISSION.closing }}</strong>
      </p>
    </section>

    <section class="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <div class="flex flex-col items-start justify-between gap-6 rounded-3xl bg-[#12201a] p-8 text-white sm:p-10 lg:flex-row lg:items-center">
        <div>
          <h2 class="text-2xl font-semibold tracking-tight">
            Have a question before you rent?
          </h2>
          <p class="mt-2 text-sm text-white/70">
            Message us on Facebook or email
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

    <section
      id="legal"
      class="border-t border-[#12201a]/8"
    >
      <div class="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 class="text-lg font-semibold text-[#12201a]">
          Privacy and terms
        </h2>
        <p class="mt-2 max-w-3xl text-sm leading-7 text-[#4a5a54]">
          Use of the website and rental service is governed by our policies below. Equipment rentals also require the current Equipment Rental Agreement & Liability Waiver. We do not sell customer data.
        </p>
        <div class="mt-6 grid gap-3 sm:grid-cols-3">
          <NuxtLink
            v-for="policy in policies"
            :key="policy.to"
            :to="policy.to"
            class="group flex items-start gap-3 rounded-2xl border border-[#12201a]/8 bg-white p-4 transition-colors hover:border-[#12201a]/25"
          >
            <UIcon
              :name="policy.icon"
              class="mt-0.5 size-5 shrink-0 text-[#12201a]"
            />
            <span class="min-w-0 flex-1">
              <span class="block font-medium text-[#12201a]">{{ policy.title }}</span>
              <span class="mt-0.5 block text-xs leading-5 text-[#5b6b64]">{{ policy.copy }}</span>
            </span>
            <UIcon
              name="i-lucide-arrow-up-right"
              class="size-4 shrink-0 text-[#5b6b64] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
