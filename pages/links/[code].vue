<script setup lang="ts">
import type { PublicSocialAd, PublicSocialPage } from '~/types/social-link'
import { APP_NAME } from '~/utils/constants'
import {
  DEFAULT_SOCIAL_BUTTON_COLOR,
  isSocialPageCode,
  normalizeSocialPageCode,
  resolveSocialButtonColor,
  socialButtonIconName,
  socialButtonTextColor,
} from '~/utils/social-link'

definePageMeta({
  layout: 'blank',
})

const route = useRoute()
const code = computed(() => normalizeSocialPageCode(String(route.params.code || '')))

if (!isSocialPageCode(code.value)) {
  throw createError({ statusCode: 404, statusMessage: 'Links page not found' })
}

const { data, error } = await useFetch<PublicSocialPage>(
  () => `/api/social-links/${code.value}`,
)

if (error.value?.statusCode === 404) {
  throw createError({ statusCode: 404, statusMessage: 'Links page not found' })
}

const pageButtonColor = computed(() => data.value?.buttonColor || DEFAULT_SOCIAL_BUTTON_COLOR)
const activeAds = computed(() => (data.value?.ads || []).filter(ad => ad.isActive))
const slideIndex = ref(0)
const slideDirection = ref<'left' | 'right'>('left')
const copyrightYear = new Date().getFullYear()
const voucherCopied = ref(false)
const copyPulse = ref(false)

useSiteMeta({
  title: data.value?.title || 'Links',
  description: data.value?.subtitle || 'Rent. Create. Explore.',
  path: `/links/${code.value}`,
})

watch(activeAds, (ads) => {
  if (slideIndex.value >= ads.length) {
    slideIndex.value = 0
  }
})

watch(slideIndex, () => {
  voucherCopied.value = false
})

let carouselTimer: ReturnType<typeof setInterval> | null = null

function startCarousel() {
  stopCarousel()
  if (activeAds.value.length < 2) {
    return
  }
  carouselTimer = setInterval(() => {
    slideDirection.value = 'left'
    slideIndex.value = (slideIndex.value + 1) % activeAds.value.length
  }, 5000)
}

function stopCarousel() {
  if (carouselTimer) {
    clearInterval(carouselTimer)
    carouselTimer = null
  }
}

onMounted(startCarousel)
onBeforeUnmount(stopCarousel)
watch(activeAds, startCarousel)

const currentAd = computed(() => activeAds.value[slideIndex.value] || null)

function buttonStyle(linkColor: string | null | undefined) {
  const background = resolveSocialButtonColor(linkColor, pageButtonColor.value)
  return {
    backgroundColor: background,
    color: socialButtonTextColor(background),
  }
}

function adHref(ad: PublicSocialAd) {
  return ad.linkUrl || null
}

function voucherDiscountBadge(ad: PublicSocialAd) {
  const voucher = ad.voucher
  if (!voucher) {
    return null
  }
  if (voucher.discountType === 'percent') {
    return `${voucher.discountValue}% OFF`
  }
  return `₱${Number(voucher.discountValue).toLocaleString('en-PH')} OFF`
}

async function copyVoucher(codeValue: string) {
  if (!import.meta.client) {
    return
  }
  try {
    await navigator.clipboard.writeText(codeValue)
    voucherCopied.value = true
    copyPulse.value = true
    window.setTimeout(() => {
      copyPulse.value = false
    }, 450)
    window.setTimeout(() => {
      voucherCopied.value = false
    }, 2000)
  }
  catch {
    voucherCopied.value = false
    copyPulse.value = false
  }
}

function goToSlide(index: number) {
  if (index === slideIndex.value) {
    return
  }
  const total = activeAds.value.length
  if (total < 2) {
    slideIndex.value = index
    return
  }
  // Prefer the shorter path; forward = swipe left, back = swipe right.
  const forward = (index - slideIndex.value + total) % total
  const backward = (slideIndex.value - index + total) % total
  slideDirection.value = forward <= backward ? 'left' : 'right'
  slideIndex.value = index
  startCarousel()
}
</script>

<template>
  <div class="min-h-screen bg-[#f3f1ec] px-4 py-10 sm:py-14">
    <div class="mx-auto flex w-full max-w-md flex-col items-center">
      <img
        src="/logo.png?v=12"
        alt="JRY Rentals"
        class="h-24 w-auto object-contain sm:h-28"
        width="280"
        height="132"
      >
      <p class="mt-4 max-w-sm text-center text-base font-medium leading-6 text-[#12201a] sm:text-lg">
        {{ data?.subtitle || 'Rent. Create. Explore.' }}
      </p>

      <p
        v-if="error"
        class="mt-8 w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800"
      >
        Links could not be loaded. Try again in a moment.
      </p>

      <ul
        v-else
        class="mt-8 flex w-full flex-col gap-3"
      >
        <li
          v-for="link in data?.links || []"
          :key="link.uuid"
        >
          <a
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full px-5 py-3 text-center text-sm font-medium shadow-sm transition hover:opacity-90"
            :style="buttonStyle(link.buttonColor)"
          >
            <UIcon
              v-if="socialButtonIconName(link.icon)"
              :name="socialButtonIconName(link.icon)!"
              class="size-4 shrink-0"
            />
            <span>{{ link.label }}</span>
          </a>
        </li>
        <li
          v-if="!(data?.links || []).length"
          class="rounded-2xl border border-dashed border-stone-300 bg-white/70 px-4 py-8 text-center text-sm text-stone-500"
        >
          No links yet.
        </li>
      </ul>

      <section
        v-if="currentAd"
        class="mt-8 w-full"
        aria-label="Promotions"
      >
        <div class="relative w-full overflow-hidden">
          <Transition :name="slideDirection === 'left' ? 'promo-swipe-left' : 'promo-swipe-right'">
          <!-- Professional voucher ticket -->
          <article
            v-if="currentAd.voucher"
            :key="`voucher-${currentAd.uuid}`"
            class="social-voucher relative w-full overflow-hidden rounded-[1.25rem] bg-white"
          >
            <component
              :is="adHref(currentAd) ? 'a' : 'div'"
              :href="adHref(currentAd) || undefined"
              :target="adHref(currentAd) ? '_blank' : undefined"
              :rel="adHref(currentAd) ? 'noopener noreferrer' : undefined"
              class="social-voucher-hero relative block overflow-hidden bg-[#12201a]"
            >
              <img
                v-if="currentAd.imageUrl"
                :src="currentAd.imageUrl"
                :alt="currentAd.title || 'Promotion'"
                class="absolute inset-0 h-full w-full object-cover"
              >
              <span
                class="social-voucher-flare"
                aria-hidden="true"
              />
              <div
                class="relative z-[1] flex min-h-[9.75rem] items-stretch text-white"
                :class="currentAd.imageUrl ? 'bg-[#12201a]/70' : ''"
              >
                <div
                  v-if="voucherDiscountBadge(currentAd)"
                  class="flex w-[5.75rem] shrink-0 flex-col items-center justify-center border-r border-white/10 bg-white/[0.06] px-2 py-5 sm:w-24"
                >
                  <p class="text-[1.65rem] font-semibold leading-none tracking-tight tabular-nums">
                    {{ currentAd.voucher.discountType === 'percent'
                      ? `${currentAd.voucher.discountValue}%`
                      : `₱${Number(currentAd.voucher.discountValue).toLocaleString('en-PH')}` }}
                  </p>
                  <p class="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
                    Off
                  </p>
                </div>
                <div class="flex min-w-0 flex-1 flex-col justify-center px-5 py-6 sm:px-6">
                  <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                    Special offer
                  </p>
                  <p class="social-voucher-title mt-1.5 text-xl font-semibold leading-snug tracking-tight sm:text-[1.35rem]">
                    {{ currentAd.title || currentAd.voucher.name || 'Special offer' }}
                  </p>
                  <p
                    v-if="currentAd.subtitle"
                    class="social-voucher-sub mt-1.5 text-sm leading-5 text-white/70"
                  >
                    {{ currentAd.subtitle }}
                  </p>
                </div>
              </div>
            </component>

            <!-- Ticket perforation -->
            <div
              class="social-voucher-perf relative"
              aria-hidden="true"
            >
              <span class="social-voucher-notch social-voucher-notch--left" />
              <span class="social-voucher-notch social-voucher-notch--right" />
              <span class="social-voucher-dots" />
            </div>

            <div class="px-5 pb-5 pt-5">
              <div
                class="social-voucher-code rounded-xl border border-dashed border-stone-300 bg-[#faf9f7] px-4 py-4 text-center"
                :class="{ 'social-voucher-code--pulse': copyPulse }"
              >
                <p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-stone-400">
                  Voucher code
                </p>
                <p class="mt-2 break-all font-mono text-[1.55rem] font-bold leading-none tracking-[0.12em] text-[#12201a]">
                  {{ currentAd.voucher.code }}
                </p>
                <p class="mt-2 text-sm text-stone-500">
                  {{ currentAd.voucher.name }}
                </p>
              </div>

              <button
                type="button"
                class="social-voucher-copy mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#12201a] px-5 text-sm font-medium text-white transition hover:bg-[#1a2d25] active:scale-[0.98]"
                :class="{ 'social-voucher-copy--done': voucherCopied }"
                @click="copyVoucher(currentAd.voucher!.code)"
              >
                <UIcon
                  :name="voucherCopied ? 'i-lucide-check' : 'i-lucide-copy'"
                  class="size-4"
                  :class="voucherCopied ? 'social-voucher-check' : ''"
                />
                {{ voucherCopied ? 'Code copied' : 'Copy code' }}
              </button>
              <p class="mt-3 text-center text-[11px] leading-4 text-stone-400">
                Use this code at checkout when you book.
              </p>
            </div>
          </article>

          <!-- Image / promo only -->
          <article
            v-else
            :key="`promo-${currentAd.uuid}`"
            class="relative w-full overflow-hidden rounded-[1.25rem] bg-white"
          >
            <component
              :is="adHref(currentAd) ? 'a' : 'div'"
              :href="adHref(currentAd) || undefined"
              :target="adHref(currentAd) ? '_blank' : undefined"
              :rel="adHref(currentAd) ? 'noopener noreferrer' : undefined"
              class="block"
            >
              <img
                v-if="currentAd.imageUrl"
                :src="currentAd.imageUrl"
                :alt="currentAd.title || 'Promotion'"
                class="block h-auto w-full bg-[#f3f1ec] object-contain"
              >
              <div
                v-else
                class="flex min-h-[9rem] w-full flex-col items-center justify-center bg-[#12201a] px-6 py-8 text-center text-white"
              >
                <p class="text-lg font-semibold tracking-tight">
                  {{ currentAd.title || 'Special offer' }}
                </p>
                <p
                  v-if="currentAd.subtitle"
                  class="mt-2 text-sm text-white/80"
                >
                  {{ currentAd.subtitle }}
                </p>
              </div>
            </component>
            <div
              v-if="currentAd.imageUrl && (currentAd.title || currentAd.subtitle)"
              class="px-5 py-4"
            >
              <p
                v-if="currentAd.title"
                class="text-sm font-semibold text-[#12201a]"
              >
                {{ currentAd.title }}
              </p>
              <p
                v-if="currentAd.subtitle"
                class="mt-1 text-sm text-stone-600"
              >
                {{ currentAd.subtitle }}
              </p>
            </div>
          </article>
          </Transition>
        </div>

        <div
          v-if="activeAds.length > 1"
          class="mt-4 flex items-center justify-center gap-2"
        >
          <button
            v-for="(ad, index) in activeAds"
            :key="ad.uuid"
            type="button"
            class="h-2 rounded-full transition-all duration-300"
            :class="index === slideIndex ? 'w-5 bg-[#12201a]' : 'w-2 bg-stone-300 hover:bg-stone-400'"
            :aria-label="`Show promotion ${index + 1}`"
            :aria-current="index === slideIndex ? 'true' : undefined"
            @click="goToSlide(index)"
          />
        </div>
      </section>

      <p class="mt-12 text-center text-xs text-stone-500">
        © {{ copyrightYear }} {{ APP_NAME }}. All rights reserved.
      </p>
    </div>
  </div>
</template>

<style scoped>
.social-voucher-perf {
  height: 1.5rem;
  background: #fff;
}

.social-voucher-dots {
  position: absolute;
  left: 1.25rem;
  right: 1.25rem;
  top: 50%;
  border-top: 2px dashed #d6d3d1;
  transform: translateY(-50%);
}

.social-voucher-notch {
  position: absolute;
  top: 50%;
  z-index: 2;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 9999px;
  background: #f3f1ec;
}

.social-voucher-notch--left {
  left: 0;
  transform: translate(-50%, -50%);
  box-shadow: inset -1px 0 0 rgb(214 211 209);
}

.social-voucher-notch--right {
  right: 0;
  transform: translate(50%, -50%);
  box-shadow: inset 1px 0 0 rgb(214 211 209);
}

.social-voucher-flare {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 2;
  background: linear-gradient(
    115deg,
    transparent 28%,
    rgba(255, 255, 255, 0.18) 46%,
    rgba(255, 255, 255, 0.05) 52%,
    transparent 68%
  );
  transform: translateX(-130%);
  animation: voucher-flare 5s ease-in-out 0.8s infinite;
}

.social-voucher-code--pulse {
  animation: code-flash 450ms ease;
}

.social-voucher-copy--done {
  background: #1a3d2e;
}

.social-voucher-check {
  animation: check-pop 350ms cubic-bezier(0.22, 1, 0.36, 1);
}

.promo-swipe-left-enter-active,
.promo-swipe-left-leave-active,
.promo-swipe-right-enter-active,
.promo-swipe-right-leave-active {
  transition: transform 620ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.promo-swipe-left-leave-active,
.promo-swipe-right-leave-active {
  position: absolute;
  inset-inline: 0;
  top: 0;
  width: 100%;
}

.promo-swipe-left-enter-from {
  transform: translate3d(100%, 0, 0);
}

.promo-swipe-left-enter-to,
.promo-swipe-left-leave-from {
  transform: translate3d(0, 0, 0);
}

.promo-swipe-left-leave-to {
  transform: translate3d(-100%, 0, 0);
}

.promo-swipe-right-enter-from {
  transform: translate3d(-100%, 0, 0);
}

.promo-swipe-right-enter-to,
.promo-swipe-right-leave-from {
  transform: translate3d(0, 0, 0);
}

.promo-swipe-right-leave-to {
  transform: translate3d(100%, 0, 0);
}

@keyframes voucher-flare {
  0%,
  62% {
    transform: translateX(-130%);
  }
  100% {
    transform: translateX(130%);
  }
}

@keyframes code-flash {
  0% {
    background: #faf9f7;
    border-color: #d6d3d1;
  }
  40% {
    background: #e8efe9;
    border-color: #12201a;
  }
  100% {
    background: #faf9f7;
    border-color: #d6d3d1;
  }
}

@keyframes check-pop {
  0% {
    transform: scale(0.6);
  }
  70% {
    transform: scale(1.15);
  }
  100% {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .social-voucher-flare,
  .social-voucher-code--pulse,
  .social-voucher-check {
    animation: none !important;
  }

  .promo-swipe-left-enter-active,
  .promo-swipe-left-leave-active,
  .promo-swipe-right-enter-active,
  .promo-swipe-right-leave-active {
    transition: none !important;
  }
}
</style>
