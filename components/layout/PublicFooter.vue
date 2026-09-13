<script setup lang="ts">
import { APP_NAME, BUSINESS_ADDRESS, BUSINESS_EMAIL, FACEBOOK_URL } from '~/utils/constants'

const year = new Date().getFullYear()
const { isAuthenticated } = useAuth()
</script>

<template>
  <footer class="bg-[#0f1c17] text-white">
    <div class="mx-auto grid max-w-7xl gap-10 px-4 py-14 text-center sm:grid-cols-2 sm:px-6 sm:text-left lg:grid-cols-5 lg:px-8">
      <div class="flex justify-center sm:justify-start">
        <AppLogo on-dark />
      </div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
          Rent
        </p>
        <ul class="mt-4 space-y-2 text-sm text-white/75">
          <li>
            <NuxtLink to="/products" class="hover:text-white">
              Equipment
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/register" class="hover:text-white">
              Create account
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/#how-it-works" class="hover:text-white">
              Explore
            </NuxtLink>
          </li>
        </ul>
      </div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
          Company
        </p>
        <ul class="mt-4 space-y-2 text-sm text-white/75">
          <li>
            <NuxtLink to="/#how-it-works" class="hover:text-white">
              How it Works
            </NuxtLink>
          </li>
          <li v-if="isAuthenticated">
            <NuxtLink to="/my-rentals" class="hover:text-white">
              My Bookings
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/about" class="hover:text-white">
              About
            </NuxtLink>
          </li>
        </ul>
      </div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
          Contact
        </p>
        <ul class="mt-4 space-y-2 text-sm text-white/75">
          <li>
            <a
              :href="`mailto:${BUSINESS_EMAIL}`"
              class="hover:text-white"
            >
              {{ BUSINESS_EMAIL }}
            </a>
          </li>
          <li>{{ BUSINESS_ADDRESS }}</li>
        </ul>
      </div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
          Follow us
        </p>
        <div class="mt-4 flex justify-center gap-3 text-white/75 sm:justify-start">
          <a
            :href="FACEBOOK_URL"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex size-9 items-center justify-center rounded-full border border-white/15 hover:border-white/40 hover:text-white"
            aria-label="JRY Rentals on Facebook"
          >
            <UIcon
              name="i-lucide-facebook"
              class="size-4"
            />
          </a>
        </div>
      </div>
    </div>

    <div class="border-t border-white/10">
      <div class="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-4 text-center text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-left lg:px-8">
        <p>© {{ year }} {{ APP_NAME }}. All rights reserved.</p>
        <div class="flex justify-center gap-4 sm:justify-start">
          <NuxtLink to="/privacy" class="hover:text-white">
            Privacy Policy
          </NuxtLink>
          <NuxtLink to="/terms" class="hover:text-white">
            Terms & Conditions
          </NuxtLink>
        </div>
      </div>
    </div>
  </footer>
</template>
