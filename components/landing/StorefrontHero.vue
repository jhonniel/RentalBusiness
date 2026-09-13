<script setup lang="ts">
const heroItems = [
  {
    src: '/storefront/starlink.png',
    alt: 'Starlink Mini',
    to: '/products/starlink-mini',
    imageClass: 'h-auto w-full object-contain',
  },
  {
    src: '/storefront/drone.png',
    alt: 'DJI drone',
    to: '/products/dji-air-3',
    imageClass: 'h-auto w-full object-contain',
  },
  {
    src: '/storefront/action-camera.png',
    alt: 'DJI Osmo 360',
    to: '/products?category=cameras',
    imageClass: 'mx-auto h-auto w-[70%] object-contain',
  },
] as const
</script>

<template>
  <section class="bg-white">
    <div class="mx-auto grid max-w-7xl items-center gap-8 bg-white px-4 pb-12 pt-8 sm:gap-10 sm:px-6 sm:pb-16 sm:pt-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:px-8 lg:pb-20 lg:pt-16">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#5b6b64]">
          Cameras / Drones / Starlink
        </p>
        <h1 class="font-display mt-3 max-w-xl text-[2rem] leading-[1.15] break-words text-[#12201a] sm:mt-4 sm:text-5xl lg:text-6xl">
          Premium Gear for Your Next Adventure
        </h1>
        <p class="mt-5 max-w-md text-base leading-7 text-[#4a5a54]">
          Rent high-quality equipment for travel, events, content, and more. Simple. Secure. Hassle-free.
        </p>
        <UButton
          to="/products"
          color="neutral"
          size="lg"
          class="mt-8 rounded-full px-5"
        >
          Browse Equipment
          <UIcon
            name="i-lucide-arrow-right"
            class="size-4"
          />
        </UButton>
      </div>

      <div class="grid min-w-0 grid-cols-3 items-center gap-2 bg-white sm:gap-6 lg:grid-cols-[1.05fr_1fr_0.85fr]">
        <NuxtLink
          v-for="item in heroItems"
          :key="item.src"
          :to="item.to"
          class="block min-w-0 bg-transparent"
        >
          <img
            :src="item.src"
            :alt="item.alt"
            width="640"
            height="480"
            :class="item.imageClass"
          >
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
