<script setup lang="ts">
import type { PublicDeviceLockedPreview, PublicDevicePage } from '~/types/registered-device'
import { APP_NAME } from '~/utils/constants'
import { formatBookingDate, formatBusinessDateTime } from '~/utils/datetime'
import { formatRentalBookingCodeInput } from '~/utils/rental'
import {
  deviceCustomerGreetingParts,
  isDevicePublicCode,
  normalizeDevicePublicCode,
  wifiJoinUri,
} from '~/utils/registered-device'

definePageMeta({
  layout: 'blank',
})

const route = useRoute()
const code = computed(() => normalizeDevicePublicCode(String(route.params.code || '')))

if (!isDevicePublicCode(code.value)) {
  throw createError({ statusCode: 404, statusMessage: 'Device not found' })
}

const unlockStorageKey = computed(() => `device-unlock:${code.value}`)

const { data: preview, error: previewError } = await useFetch<PublicDeviceLockedPreview>(
  () => `/api/devices/${code.value}`,
)

if (previewError.value?.statusCode === 404) {
  throw createError({ statusCode: 404, statusMessage: 'Device not found' })
}

const unlocked = ref<PublicDevicePage | null>(null)
const rentalCode = ref('JRY-')
const unlockError = ref('')
const unlocking = ref(false)

function onRentalCodeInput(value: string) {
  rentalCode.value = formatRentalBookingCodeInput(value)
  if (unlockError.value) {
    unlockError.value = ''
  }
}

function onRentalCodeFocus(event: FocusEvent) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) {
    return
  }
  // Keep JRY- and place the cursor after the prefix for quick entry.
  if (rentalCode.value === 'JRY-' || rentalCode.value === 'LUM-') {
    requestAnimationFrame(() => {
      const offset = rentalCode.value.length
      input.setSelectionRange(offset, offset)
    })
  }
}

useSiteMeta({
  title: preview.value?.label || 'Device',
  description: preview.value
    ? `${preview.value.productName} · enter your booking code to unlock`
    : 'Registered device details',
  path: `/devices/${code.value}`,
})

async function unlockWithCode(entered: string) {
  const trimmed = formatRentalBookingCodeInput(entered).replace(/-$/, '')
  if (!trimmed || trimmed === 'JRY' || trimmed === 'LUM') {
    unlockError.value = 'Enter your rental booking code.'
    return
  }
  rentalCode.value = formatRentalBookingCodeInput(entered)

  unlocking.value = true
  unlockError.value = ''
  try {
    const page = await $fetch<PublicDevicePage>(`/api/devices/${code.value}/unlock`, {
      method: 'POST',
      body: { rentalCode: trimmed },
    })
    unlocked.value = page
    rentalCode.value = trimmed
    if (import.meta.client) {
      sessionStorage.setItem(unlockStorageKey.value, trimmed)
    }
  }
  catch (error: unknown) {
    unlocked.value = null
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string, statusMessage?: string } }).data
      : null
    unlockError.value = payload?.message
      || payload?.statusMessage
      || 'We could not unlock this device with that booking code.'
    if (import.meta.client) {
      sessionStorage.removeItem(unlockStorageKey.value)
    }
  }
  finally {
    unlocking.value = false
  }
}

async function onUnlockSubmit() {
  await unlockWithCode(rentalCode.value)
}

onMounted(() => {
  const saved = sessionStorage.getItem(unlockStorageKey.value)
  if (saved && !unlocked.value) {
    rentalCode.value = saved
    void unlockWithCode(saved)
  }
})

const copyrightYear = new Date().getFullYear()
const data = computed(() => unlocked.value)
const greeting = computed(() => {
  const booking = unlocked.value?.booking
  if (!booking) {
    return null
  }
  return deviceCustomerGreetingParts(booking.customerFirstName)
})

const passwordCopied = ref(false)
const joinHint = ref('')
let copiedTimer: ReturnType<typeof setTimeout> | null = null

async function copyWifiPassword() {
  const text = data.value?.wifiPassword?.trim() || ''
  if (!text || !import.meta.client) {
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    passwordCopied.value = true
    if (copiedTimer) {
      clearTimeout(copiedTimer)
    }
    copiedTimer = setTimeout(() => {
      passwordCopied.value = false
    }, 1800)
  }
  catch {
    passwordCopied.value = false
  }
}

async function joinWifi() {
  const name = data.value?.wifiName?.trim() || ''
  const password = data.value?.wifiPassword?.trim() || ''
  if (!name || !password || !import.meta.client) {
    return
  }

  joinHint.value = ''
  await copyWifiPassword()

  const uri = wifiJoinUri(name, password)
  const android = /Android/i.test(navigator.userAgent)
  if (android && uri) {
    window.location.href = uri
    return
  }

  joinHint.value = 'Password copied. Open Wi‑Fi settings and paste it.'
}
</script>

<template>
  <div class="device-page min-h-screen bg-[#0f1a15] text-stone-100">
    <div class="device-glow pointer-events-none absolute inset-x-0 top-0 h-72 opacity-70" />

    <main class="relative mx-auto flex min-h-screen w-full max-w-lg flex-col items-center px-5 pb-10 pt-10 sm:px-6">
      <img
        src="/logo-on-dark.png?v=12"
        :alt="APP_NAME"
        class="h-24 w-auto object-contain sm:h-28"
        width="280"
        height="132"
      >
      <p class="mt-4 max-w-sm text-center text-base font-medium leading-6 text-emerald-100/90 sm:text-lg">
        Rent. Create. Explore.
      </p>

      <template v-if="preview && !data">
        <header class="mt-8 w-full text-center">
          <p class="text-base text-emerald-100/90 sm:text-lg">
            {{ preview.productName }}
          </p>
          <h1 class="mt-1 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {{ preview.label }}
          </h1>
        </header>

        <section class="mt-8 w-full overflow-hidden rounded-2xl border border-emerald-400/15 bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.65)]">
          <div class="border-b border-white/10 px-5 py-5 sm:px-6">
            <h2 class="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Unlock with booking
            </h2>
            <p class="mt-2 max-w-md text-sm leading-6 text-stone-400 sm:text-base">
              Enter the rental booking code linked to this device to view bag and Wi‑Fi details.
            </p>
          </div>

          <form
            class="space-y-5 px-5 py-5 sm:px-6 sm:py-6"
            @submit.prevent="onUnlockSubmit"
          >
            <div class="space-y-2.5">
              <label
                for="device-rental-code"
                class="block text-sm font-medium text-stone-200"
              >
                Rental booking code
              </label>
              <div
                class="rounded-xl border bg-[#0b1410]/80 transition-colors"
                :class="unlockError
                  ? 'border-red-400/50 ring-1 ring-red-400/30'
                  : 'border-white/12 focus-within:border-emerald-400/45 focus-within:ring-1 focus-within:ring-emerald-400/25'"
              >
                <input
                  id="device-rental-code"
                  :value="rentalCode"
                  type="text"
                  inputmode="text"
                  autocomplete="off"
                  autocapitalize="characters"
                  spellcheck="false"
                  placeholder="JRY-20261120-00001"
                  :disabled="unlocking"
                  class="block w-full rounded-xl border-0 bg-transparent px-4 py-3.5 font-mono text-base tracking-[0.08em] text-white outline-none placeholder:text-stone-600 disabled:opacity-60 sm:text-lg"
                  @input="onRentalCodeInput(($event.target as HTMLInputElement).value)"
                  @focus="onRentalCodeFocus"
                >
              </div>
              <p
                v-if="unlockError"
                class="text-sm leading-5 text-red-300"
                role="alert"
              >
                {{ unlockError }}
              </p>
              <p
                v-else
                class="text-xs leading-5 text-stone-500 sm:text-sm"
              >
                Example: JRY-20261120-00001
              </p>
            </div>

            <button
              type="submit"
              class="inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-3.5 text-base font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="unlocking"
            >
              <span
                v-if="unlocking"
                class="mr-2 size-4 animate-spin rounded-full border-2 border-emerald-950/30 border-t-emerald-950"
                aria-hidden="true"
              />
              {{ unlocking ? 'Checking booking…' : 'Unlock details' }}
            </button>
          </form>
        </section>
      </template>

      <template v-else-if="data">
        <p
          v-if="greeting"
          class="mt-6 w-full text-center text-xl leading-8 tracking-normal text-stone-300 sm:mt-7 sm:text-2xl"
        >
          <template v-if="greeting.firstName">
            <span>{{ greeting.salutation }},</span>
            <span class="ml-1.5 font-semibold text-white">{{ greeting.firstName }}</span>
          </template>
          <span v-else>{{ greeting.salutation }}</span>
        </p>
        <header
          class="w-full text-center"
          :class="greeting ? 'mt-3' : 'mt-6 sm:mt-8'"
        >
          <p class="text-sm text-emerald-100/90 sm:text-base">
            {{ data.productName }}
          </p>
          <h1 class="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {{ data.label }}
          </h1>
        </header>

        <section
          v-if="data.bagPin || data.wifiName || data.wifiPassword"
          class="mt-6 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-5 sm:mt-8 sm:px-6 sm:py-6"
        >
          <h2 class="text-center text-base font-semibold text-white sm:text-lg">
            Details
          </h2>
          <dl class="mt-4 divide-y divide-white/10 text-center">
            <div
              v-if="data.bagPin"
              class="flex flex-col items-center gap-1 py-4 first:pt-0 last:pb-0"
            >
              <dt class="text-xs font-medium uppercase tracking-[0.14em] text-stone-400">
                Bag Pin
              </dt>
              <dd class="font-mono text-3xl font-semibold tracking-[0.2em] text-white">
                {{ data.bagPin }}
              </dd>
            </div>
            <div
              v-if="data.wifiName"
              class="flex flex-col items-center gap-1 py-4 first:pt-0 last:pb-0"
            >
              <dt class="text-xs font-medium uppercase tracking-[0.14em] text-stone-400">
                Wi‑Fi Name
              </dt>
              <dd class="max-w-full break-all text-lg font-semibold text-white sm:text-xl">
                {{ data.wifiName }}
              </dd>
            </div>
            <div
              v-if="data.wifiPassword"
              class="flex flex-col items-center gap-1 py-4 first:pt-0 last:pb-0"
            >
              <dt class="text-xs font-medium uppercase tracking-[0.14em] text-stone-400">
                Wi‑Fi Password
              </dt>
              <dd class="flex max-w-full items-center justify-center gap-2">
                <span class="min-w-0 break-all font-mono text-lg font-semibold tracking-wide text-white sm:text-xl">
                  {{ data.wifiPassword }}
                </span>
                <button
                  type="button"
                  class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-stone-300 transition hover:bg-white/10 hover:text-white"
                  :aria-label="passwordCopied ? 'Wi‑Fi password copied' : 'Copy Wi‑Fi password'"
                  @click="copyWifiPassword"
                >
                  <UIcon
                    :name="passwordCopied ? 'i-lucide-check' : 'i-lucide-copy'"
                    class="size-4"
                  />
                </button>
              </dd>
              <div
                v-if="data.wifiName"
                class="mt-3 w-full md:hidden"
              >
                <button
                  type="button"
                  class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
                  @click="joinWifi"
                >
                  <UIcon
                    name="i-lucide-wifi"
                    class="size-4"
                  />
                  Join Wi‑Fi
                </button>
                <p
                  v-if="joinHint"
                  class="mt-2 text-center text-xs leading-5 text-stone-400"
                >
                  {{ joinHint }}
                </p>
              </div>
            </div>
          </dl>
        </section>

        <section class="mt-4 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-5 sm:mt-5 sm:px-6 sm:py-6">
          <h2 class="text-center text-base font-semibold text-white sm:text-lg">
            What’s in the bag
          </h2>
          <ul
            v-if="data.bagContents.length"
            class="mx-auto mt-4 max-w-xs space-y-2.5 text-sm leading-6 text-stone-100 sm:max-w-sm sm:text-base"
          >
            <li
              v-for="(item, index) in data.bagContents"
              :key="`${index}-${item}`"
              class="flex items-start justify-center gap-2.5 text-left"
            >
              <span class="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-300/90" />
              <span class="min-w-0 flex-1">{{ item }}</span>
            </li>
          </ul>
          <p
            v-else
            class="mt-3 text-center text-sm text-stone-400"
          >
            No bag contents listed for this unit.
          </p>
        </section>

        <section
          v-if="data.booking"
          class="mt-4 w-full rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-5 sm:mt-5 sm:px-6 sm:py-6"
        >
          <h2 class="text-center text-sm font-medium text-amber-100/80 sm:text-base">
            Return Date and Time
          </h2>
          <p class="mt-3 text-center text-2xl font-semibold tracking-tight text-amber-50 sm:text-3xl">
            {{ data.booking.returnAt
              ? formatBusinessDateTime(data.booking.returnAt)
              : formatBookingDate(data.booking.endsOn) }}
          </p>
        </section>
      </template>

      <div
        v-else
        class="mt-8 w-full rounded-2xl border border-white/10 bg-white/[0.04] p-5"
      >
        <h1 class="text-xl font-semibold text-white">
          Device unavailable
        </h1>
        <p class="mt-2 text-sm text-stone-400">
          This QR code could not be loaded right now.
        </p>
      </div>

      <p class="mt-auto pt-12 text-center text-xs text-stone-500">
        © {{ copyrightYear }} {{ APP_NAME }}
      </p>
    </main>
  </div>
</template>

<style scoped>
.device-page {
  position: relative;
  overflow: hidden;
}

.device-glow {
  background:
    radial-gradient(ellipse 80% 50% at 50% -10%, rgba(52, 211, 153, 0.28), transparent 70%),
    radial-gradient(ellipse 60% 40% at 100% 20%, rgba(16, 185, 129, 0.12), transparent 60%);
}
</style>
