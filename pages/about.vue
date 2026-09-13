<script setup lang="ts">
import { APP_NAME } from '~/utils/constants'
import { aboutPageJsonLd } from '~/utils/seo'

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

const values = [
  {
    title: 'Simple',
    copy: 'A straightforward rental process without unnecessary complications.',
  },
  {
    title: 'Reliable',
    copy: 'We focus on providing a dependable experience and properly maintained rental equipment.',
  },
  {
    title: 'Convenient',
    copy: 'Browse, book, manage your rental, and make payments with ease.',
  },
  {
    title: 'Secure',
    copy: 'We prioritize secure bookings, payments, and responsible handling of customer information.',
  },
]
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6b64]">
      About {{ APP_NAME }}
    </p>
    <h1 class="font-display mt-3 text-3xl text-[#12201a] sm:text-4xl">
      Rent. Create. Explore.
    </h1>
    <p class="mt-4 text-lg text-[#3b4a44]">
      <strong class="font-semibold text-[#12201a]">{{ APP_NAME }}</strong> is a modern rental service designed to make renting simple, convenient, and accessible.
    </p>
    <p class="mt-4 text-sm leading-7 text-[#4a5a54]">
      We believe customers should be able to get what they need without the commitment and cost of purchasing. Our goal is to provide a smooth rental experience—from browsing and booking to payment and return.
    </p>

    <section class="mt-12">
      <h2 class="text-xl font-semibold text-[#12201a]">
        What We Stand For
      </h2>
      <ul class="mt-6 grid gap-4 sm:grid-cols-2">
        <li
          v-for="value in values"
          :key="value.title"
          class="rounded-2xl border border-[#12201a]/8 bg-white p-5"
        >
          <h3 class="font-semibold text-[#12201a]">
            {{ value.title }}
          </h3>
          <p class="mt-2 text-sm leading-6 text-[#4a5a54]">
            {{ value.copy }}
          </p>
        </li>
      </ul>
    </section>

    <section class="mt-12">
      <h2 class="text-xl font-semibold text-[#12201a]">
        Our Mission
      </h2>
      <p class="mt-3 text-sm leading-7 text-[#4a5a54]">
        Our mission is to make renting <strong class="font-semibold text-[#12201a]">easier, more accessible, and more convenient</strong> for everyone.
      </p>
      <p class="mt-3 text-sm leading-7 text-[#4a5a54]">
        Whether you're preparing for an adventure, working on a project, creating content, or simply need something for a short period,
        <strong class="font-semibold text-[#12201a]">{{ APP_NAME }} is here to make the process easier.</strong>
      </p>
    </section>

    <p class="mt-12 text-center text-sm font-semibold tracking-[0.18em] text-[#5b6b64]">
      {{ APP_NAME }}
    </p>
    <p class="mt-2 text-center font-display text-2xl text-[#12201a]">
      Rent. Create. Explore.
    </p>

    <section
      id="legal"
      class="mt-14 border-t border-[#12201a]/8 pt-10"
    >
      <h2 class="text-xl font-semibold text-[#12201a]">
        Privacy and terms
      </h2>
      <p class="mt-3 text-sm leading-7 text-[#4a5a54]">
        Use of the website and rental service is governed by the
        <NuxtLink
          to="/terms"
          class="font-medium text-[#12201a] underline-offset-4 hover:underline"
        >Terms & Conditions</NuxtLink>.
        How we collect and use personal information is explained in the
        <NuxtLink
          to="/privacy"
          class="font-medium text-[#12201a] underline-offset-4 hover:underline"
        >JRY Rentals Privacy Policy</NuxtLink>.
        Equipment rentals also require the current Equipment Rental Agreement & Liability Waiver.
        We do not sell customer data.
      </p>
    </section>
  </section>
</template>
