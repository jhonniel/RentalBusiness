<script setup lang="ts">
import FeedbackStarRating from '~/components/feedback/FeedbackStarRating.vue'

withDefaults(defineProps<{
  kind?: 'site' | 'feedback'
}>(), {
  kind: 'site',
})
</script>

<template>
  <div class="space-y-3">
    <figure class="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <img
        :src="kind === 'feedback' ? '/og-feedback.png' : '/og.png'"
        :alt="kind === 'feedback'
          ? 'JRY Rentals logo and the feedback page: How was your rental, with star ratings'
          : 'JRY Rentals logo'"
        class="aspect-[1200/630] w-full object-cover"
        width="1200"
        height="630"
      >
      <figcaption class="border-t border-stone-100 px-3 py-2">
        <p class="text-[11px] font-medium tracking-wide text-stone-500 uppercase">
          Link preview
        </p>
        <p class="text-sm font-medium text-stone-900">
          {{ kind === 'feedback' ? 'Rate your rental · JRY Rentals' : 'JRY Rentals · Equipment Rentals' }}
        </p>
      </figcaption>
    </figure>

    <div
      v-if="kind === 'feedback'"
      class="overflow-hidden rounded-xl border border-[#12201a]/10 bg-[#f3f5f4]"
    >
      <div class="flex items-center justify-between gap-3 border-b border-[#12201a]/10 bg-white px-3 py-2">
        <img
          src="/logo.png"
          alt="JRY Rentals"
          class="h-8 w-auto"
          width="137"
          height="64"
        >
        <p class="text-[11px] font-medium text-[#5b6b64]">
          Takes about a minute
        </p>
      </div>
      <div class="space-y-3 p-3">
        <p class="text-[11px] font-semibold tracking-[0.16em] text-[#5b6b64] uppercase">
          What the customer sees
        </p>
        <h4 class="font-display text-xl leading-tight text-[#12201a]">
          How was your rental?
        </h4>
        <section class="rounded-xl border border-[#12201a]/8 bg-white p-3">
          <p class="text-sm font-semibold text-[#12201a]">
            Your overall experience
          </p>
          <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-sm text-[#3b4a44]">
              How was the equipment?
            </p>
            <FeedbackStarRating
              :model-value="0"
              read-only
              size="sm"
              label="How was the equipment?"
            />
          </div>
          <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-sm text-[#3b4a44]">
              How was our service?
            </p>
            <FeedbackStarRating
              :model-value="0"
              read-only
              size="sm"
              label="How was our service?"
            />
          </div>
        </section>
        <section class="rounded-xl border border-[#12201a]/8 bg-white p-3">
          <p class="text-sm font-semibold text-[#12201a]">
            Anything else you want to tell us?
          </p>
          <div class="mt-2 h-12 rounded-md border border-stone-200 bg-stone-50" />
        </section>
      </div>
    </div>
  </div>
</template>
