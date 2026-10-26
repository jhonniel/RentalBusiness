<script setup lang="ts">
import { HOW_IT_WORKS_INTRO, HOW_IT_WORKS_STEPS } from '~/utils/site-content'

const steps = HOW_IT_WORKS_STEPS
</script>

<template>
  <section
    id="how-it-works"
    class="border-y border-[#12201a]/6 bg-white"
  >
    <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <h2 class="text-2xl font-semibold tracking-tight text-[#12201a]">
        How It Works
      </h2>
      <p class="mt-1 text-sm text-[#5b6b64]">
        {{ HOW_IT_WORKS_INTRO }}
      </p>
      <ol class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <li
          v-for="(step, index) in steps"
          :key="step.title"
          class="flex gap-3"
        >
          <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#12201a] text-xs font-semibold text-white">
            {{ index + 1 }}
          </span>
          <div>
            <h3 class="font-semibold text-[#12201a]">
              {{ step.title }}
            </h3>
            <p class="mt-1 text-sm leading-6 text-[#5b6b64]">
              {{ step.copy }}
            </p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>
