<script setup lang="ts">
import { FACEBOOK_MESSENGER_URL } from '~/utils/constants'
</script>

<template>
  <aside
    class="border-t border-[#12201a]/8 bg-white/70 px-4 py-4"
    aria-label="Contact us"
  >
    <p class="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm text-[#5b6b64]">
      <UIcon
        name="i-lucide-message-circle"
        class="size-4 shrink-0"
      />
      Need help?
      <a
        :href="FACEBOOK_MESSENGER_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 font-medium text-[#1877f2] underline-offset-2 hover:underline"
      >
        <UIcon
          name="i-lucide-facebook"
          class="size-4"
        />
        Message us on Facebook
      </a>
    </p>
  </aside>
</template>
