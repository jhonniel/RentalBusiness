<script setup lang="ts">
import type { PublicPrivacyPolicy } from '~/types/privacy'
import { APP_NAME } from '~/utils/constants'
import { formatBusinessDate } from '~/utils/datetime'

useSiteMeta({
  title: 'Privacy Policy',
  description: 'How JRY Rentals collects, uses, and protects personal information under the Philippine Data Privacy Act of 2012.',
  path: '/privacy',
})

const { data: policy, error } = await useFetch<PublicPrivacyPolicy>('/api/privacy/current')
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6b64]">
      {{ APP_NAME }}
    </p>
    <h1 class="font-display mt-3 text-4xl text-[#12201a]">
      {{ policy?.title || 'Privacy Policy' }}
    </h1>
    <p
      v-if="policy"
      class="mt-3 text-sm text-[#4a5a54]"
    >
      Version {{ policy.version }} · Effective {{ formatBusinessDate(policy.effectiveDate) }} · Last updated {{ formatBusinessDate(policy.lastUpdated) }}
    </p>
    <p class="mt-4 text-sm leading-7 text-[#4a5a54]">
      This policy is versioned. If we publish a later version, accounts and bookings that already accepted this copy keep this snapshot.
    </p>
    <CatalogNotice
      v-if="error"
      class="mt-8"
      title="Privacy Policy is not available"
      description="Please try again in a moment, or email jryrentals@gmail.com."
    />
    <div
      v-else-if="policy"
      class="mt-8 whitespace-pre-wrap text-sm leading-7 text-[#3b4a44]"
    >
      {{ policy.body }}
    </div>
  </section>
</template>
