<script setup lang="ts">
import { FACEBOOK_MESSENGER_URL } from '~/utils/constants'

const props = defineProps<{
  current: number
}>()

const steps = ['Rental details', 'Sign waiver', 'Upload ID', 'Submit request']

function state(index: number) {
  if (index < props.current) {
    return 'done'
  }
  return index === props.current ? 'current' : 'next'
}
</script>

<template>
  <div>
    <ol
      class="grid grid-cols-4 gap-2 text-[11px] sm:text-xs"
      aria-label="Booking steps"
    >
      <li
        v-for="(step, index) in steps"
        :key="step"
        class="flex flex-col gap-2"
        :aria-current="state(index) === 'current' ? 'step' : undefined"
      >
        <span class="h-1 overflow-hidden rounded-full bg-[#12201a]/10">
          <span
            v-if="state(index) !== 'next'"
            class="booking-step-fill block h-full rounded-full bg-[#12201a]"
            :style="{ animationDelay: `${index * 140}ms` }"
          />
        </span>
        <span
          class="flex items-center gap-1.5"
          :class="state(index) === 'current'
            ? 'font-semibold text-[#12201a]'
            : state(index) === 'done' ? 'text-[#12201a]' : 'text-[#5b6b64]'"
        >
          <UIcon
            v-if="state(index) === 'done'"
            name="i-lucide-check"
            class="booking-step-check size-3.5 shrink-0 text-emerald-600"
            :style="{ animationDelay: `${index * 140 + 320}ms` }"
          />
          <span
            v-else-if="state(index) === 'current'"
            class="relative flex size-2 shrink-0"
          >
            <span class="booking-step-ping absolute inline-flex size-full rounded-full bg-[#12201a]/40" />
            <span class="relative inline-flex size-2 rounded-full bg-[#12201a]" />
          </span>
          <span
            v-else
            class="tabular-nums"
          >{{ index + 1 }}.</span>
          <span
            class="booking-step-label"
            :style="{ animationDelay: `${index * 80}ms` }"
          >{{ step }}</span>
        </span>
      </li>
    </ol>
    <p class="booking-step-label mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-[#5b6b64] lg:justify-end">
      <UIcon
        name="i-lucide-message-circle"
        class="size-3.5 shrink-0"
      />
      Need help?
      <a
        :href="FACEBOOK_MESSENGER_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 font-medium text-[#1877f2] underline-offset-2 hover:underline"
      >
        <UIcon
          name="i-lucide-facebook"
          class="size-3.5"
        />
        Message us on Facebook
      </a>
    </p>
  </div>
</template>

<style scoped>
.booking-step-fill {
  transform-origin: left center;
  animation: booking-step-fill 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.booking-step-check {
  animation: booking-step-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.booking-step-ping {
  animation: booking-step-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.booking-step-label {
  animation: booking-step-fade 500ms ease-out both;
}

@keyframes booking-step-fill {
  from {
    transform: scaleX(0);
  }
}

@keyframes booking-step-pop {
  from {
    opacity: 0;
    transform: scale(0.3);
  }
}

@keyframes booking-step-ping {
  75%,
  100% {
    opacity: 0;
    transform: scale(2.4);
  }
}

@keyframes booking-step-fade {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .booking-step-fill,
  .booking-step-check,
  .booking-step-ping,
  .booking-step-label {
    animation: none;
  }
}
</style>
