<script setup lang="ts">
import type { PublicTerms } from '~/types/terms'
import { APP_NAME } from '~/utils/constants'
import { formatBusinessDate } from '~/utils/datetime'

useSiteMeta({
  title: 'Terms & Conditions',
  description: 'Terms governing the JRY Rentals website, bookings, payments, and equipment rental services.',
  path: '/terms',
})

const { data: terms, error } = await useFetch<PublicTerms>('/api/terms/current')
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6b64]">
      {{ APP_NAME }}
    </p>
    <h1 class="font-display mt-3 text-4xl text-[#12201a]">
      {{ terms?.title || 'Terms & Conditions' }}
    </h1>
    <p
      v-if="terms"
      class="mt-3 text-sm text-[#4a5a54]"
    >
      Version {{ terms.version }} · Effective {{ formatBusinessDate(terms.effectiveDate) }} · Last updated {{ formatBusinessDate(terms.lastUpdated) }}
    </p>
    <p class="mt-4 text-sm leading-7 text-[#4a5a54]">
      These Terms are versioned and separate from the Privacy Policy and the Equipment Rental Agreement & Liability Waiver. Accounts and bookings that already accepted this copy keep this snapshot.
    </p>
    <CatalogNotice
      v-if="error"
      class="mt-8"
      title="Terms & Conditions are not available"
      description="Please try again in a moment, or email jryrentals@gmail.com."
    />
    <div
      v-else-if="terms"
      class="mt-8 whitespace-pre-wrap text-sm leading-7 text-[#3b4a44]"
    >
      {{ terms.body }}
    </div>
  </section>
</template>
