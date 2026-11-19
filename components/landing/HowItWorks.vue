<script setup lang="ts">
import { FACEBOOK_URL, INSTAGRAM_URL } from '~/utils/constants'
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
      <p class="mt-2 max-w-3xl text-sm leading-6 text-[#5b6b64]">
        {{ HOW_IT_WORKS_INTRO }}
      </p>
      <ol class="mt-8 space-y-4">
        <li
          v-for="(step, index) in steps"
          :key="step.title"
          class="min-w-0 rounded-3xl border border-[#12201a]/8 bg-[#f7f8f7] p-4 sm:p-6"
          :class="step.image ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(16rem,36rem)] lg:items-center lg:gap-6' : ''"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-3">
              <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#12201a] text-xs font-semibold text-white sm:size-9">
                {{ index + 1 }}
              </span>
              <h3 class="font-semibold text-[#12201a]">
                {{ step.title }}
              </h3>
            </div>
            <p class="mt-3 text-sm leading-6 text-[#5b6b64]">
              {{ step.copy }}
            </p>
            <div
              v-if="step.contact"
              class="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2"
            >
              <a
                :href="FACEBOOK_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1877f2] px-4 text-sm font-medium text-white hover:bg-[#1467d1]"
              >
                <UIcon
                  name="i-lucide-facebook"
                  class="size-4"
                />
                Facebook page
              </a>
              <a
                :href="INSTAGRAM_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#12201a] px-4 text-sm font-medium text-white hover:bg-[#1b2d26]"
              >
                <UIcon
                  name="i-lucide-instagram"
                  class="size-4"
                />
                Instagram
              </a>
            </div>
          </div>
          <div
            v-if="step.image"
            class="mt-4 overflow-x-auto rounded-2xl border border-[#12201a]/8 bg-white lg:mt-0"
          >
            <img
              :src="step.image"
              :alt="step.imageAlt"
              class="h-auto max-w-none"
              :class="step.imageWide ? 'w-[40rem] sm:w-full' : 'w-full'"
            >
          </div>
          <p
            v-if="step.imageWide"
            class="mt-2 text-xs text-[#5b6b64] sm:hidden lg:col-span-2"
          >
            Swipe the picture to see the full screen.
          </p>
        </li>
      </ol>
    </div>
  </section>
</template>
