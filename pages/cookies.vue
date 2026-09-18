<script setup lang="ts">
import type { PublicCookiePolicy } from '~/types/cookies'
import { APP_NAME } from '~/utils/constants'
import { formatBusinessDate } from '~/utils/datetime'

useSiteMeta({
  title: 'Cookie Policy',
  description: 'How JRY Rentals uses cookies and similar technologies to run the website, keep you signed in, and protect your session.',
  path: '/cookies',
})

const { data: policy, error } = await useFetch<PublicCookiePolicy>('/api/cookie-policy/current')
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6b64]">
      {{ APP_NAME }}
    </p>
    <h1 class="font-display mt-3 text-3xl text-[#12201a] sm:text-4xl">
      {{ policy?.title || 'Cookie Policy' }}
    </h1>
    <p
      v-if="policy"
      class="mt-3 text-sm text-[#4a5a54]"
    >
      Version {{ policy.version }} · Effective {{ formatBusinessDate(policy.effectiveDate) }} · Last updated {{ formatBusinessDate(policy.lastUpdated) }}
    </p>
    <p class="mt-4 text-sm leading-7 text-[#4a5a54]">
      This policy is versioned and separate from the Privacy Policy and Terms & Conditions. It explains the cookies needed to sign in and run the site. We do not use advertising cookies today.
    </p>
    <CatalogNotice
      v-if="error"
      class="mt-8"
      title="Cookie Policy is not available"
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
