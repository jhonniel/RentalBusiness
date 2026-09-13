<script setup lang="ts">
const points = [
  'Check live availability before you book',
  'Sign the digital waiver in one step',
  'Pay deposits and keep receipts in PHP',
]
</script>

<template>
  <div class="min-h-dvh bg-[#f4f6f4] lg:grid lg:grid-cols-2">
    <SkipToContent />

    <aside class="relative hidden overflow-hidden bg-[#0f1c17] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
      <AppLogo on-dark />
      <div class="relative z-10 max-w-md">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
          Cameras / Drones / Starlink
        </p>
        <h2 class="font-display mt-4 text-4xl leading-tight">
          Rent the kit. Keep the shoot moving.
        </h2>
        <p class="mt-4 text-sm leading-6 text-white/70">
          Sign in to request dates, complete the current waiver, and manage bookings from Davao City.
        </p>
        <ul class="mt-8 space-y-3 text-sm text-white/80">
          <li
            v-for="point in points"
            :key="point"
            class="flex gap-3"
          >
            <span class="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[#0f1c17]">
              <UIcon
                name="i-lucide-check"
                class="size-3"
              />
            </span>
            {{ point }}
          </li>
        </ul>
      </div>
      <p class="relative z-10 text-sm text-white/45">
        JRY Rentals · Davao City, Philippines
      </p>
    </aside>

    <div class="flex min-h-dvh flex-col">
      <header class="flex items-center justify-between px-4 py-5 sm:px-8 lg:justify-end">
        <AppLogo class="lg:hidden" />
        <UButton
          to="/"
          color="neutral"
          variant="ghost"
          class="rounded-full"
        >
          Back to storefront
        </UButton>
      </header>

      <main
        id="main-content"
        class="flex flex-1 items-center justify-center px-4 pb-16 sm:px-8"
      >
        <div class="auth-panel w-full max-w-[440px] rounded-2xl border border-[#12201a]/8 bg-white p-6 shadow-[0_18px_40px_rgb(18_32_26_/_6%)] sm:p-8">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
