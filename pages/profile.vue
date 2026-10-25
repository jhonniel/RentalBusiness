<script setup lang="ts">
import { fieldErrors, updateProfileSchema } from '~/utils/auth-validation'
import { CURRENT_PRIVACY_POLICY_VERSION } from '~/utils/privacy-policy'
import { CURRENT_TERMS_VERSION } from '~/utils/terms'
import { formatBusinessDateTime } from '~/utils/datetime'

definePageMeta({
  layout: 'account',
  middleware: 'auth',
})

useSiteMeta({
  title: 'Profile',
  path: '/profile',
})

const { profile, refreshProfile } = useAuth()
const toast = useToast()

const form = reactive({
  firstName: '',
  lastName: '',
  phone: '',
  marketingOptIn: false,
  privacyAcknowledged: false,
  termsAccepted: false,
})
const errors = ref<Record<string, string>>({})
const formError = ref('')
const pending = ref(false)

const fullName = computed(() => [profile.value?.firstName, profile.value?.lastName].filter(Boolean).join(' ') || 'Your profile')
const initials = computed(() => [profile.value?.firstName, profile.value?.lastName]
  .filter(Boolean)
  .map(part => part![0]?.toUpperCase())
  .join('') || '?')
const dirty = computed(() => Boolean(profile.value) && (
  form.firstName !== profile.value!.firstName
  || form.lastName !== profile.value!.lastName
  || form.phone !== (profile.value!.phone ?? '')
  || form.marketingOptIn !== profile.value!.marketingOptIn
  || (!profile.value!.privacyPolicyVersion && form.privacyAcknowledged)
  || (!profile.value!.termsVersion && form.termsAccepted)
))

function resetForm() {
  if (!profile.value) {
    return
  }
  form.firstName = profile.value.firstName
  form.lastName = profile.value.lastName
  form.phone = profile.value.phone ?? ''
  form.marketingOptIn = profile.value.marketingOptIn
  form.privacyAcknowledged = Boolean(profile.value.privacyPolicyVersion)
  form.termsAccepted = Boolean(profile.value.termsVersion)
  errors.value = {}
  formError.value = ''
}

watch(profile, (value) => {
  if (!value) {
    return
  }

  form.firstName = value.firstName
  form.lastName = value.lastName
  form.phone = value.phone ?? ''
  form.marketingOptIn = value.marketingOptIn
  form.privacyAcknowledged = Boolean(value.privacyPolicyVersion)
  form.termsAccepted = Boolean(value.termsVersion)
}, { immediate: true })

async function onSubmit() {
  formError.value = ''
  errors.value = {}

  const parsed = updateProfileSchema.safeParse(form)
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    return
  }

  pending.value = true

  try {
    await $fetch('/api/auth/profile', {
      method: 'PATCH',
      body: {
        ...parsed.data,
        privacyAcknowledged: !profile.value?.privacyPolicyVersion && form.privacyAcknowledged,
        termsAccepted: !profile.value?.termsVersion && form.termsAccepted,
      },
    })
    await refreshProfile()
    toast.add({
      title: 'Profile saved',
      color: 'success',
    })
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not update your profile.'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col">
    <section class="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <header class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#5c6a64]">
          Account
        </p>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight break-words text-[#12201a] sm:text-3xl">
          Profile
        </h1>
        <p class="mt-1 text-sm text-[#5c6a64]">
          Your details are used on bookings, waivers, and receipts.
        </p>
      </header>

      <section class="account-panel mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <span class="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#12201a] text-xl font-semibold text-white">
          {{ initials }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-lg font-semibold break-words text-[#12201a]">
            {{ fullName }}
          </p>
          <p class="mt-0.5 flex items-center gap-1.5 text-sm break-all text-[#5c6a64]">
            <UIcon
              name="i-lucide-mail"
              class="size-4 shrink-0"
            />
            {{ profile?.email || 'No email on file' }}
            <span
              v-if="profile?.emailVerified"
              class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
            >
              <UIcon
                name="i-lucide-badge-check"
                class="size-3"
              />
              Verified
            </span>
          </p>
          <p
            v-if="profile?.phone"
            class="mt-0.5 flex items-center gap-1.5 text-sm text-[#5c6a64]"
          >
            <UIcon
              name="i-lucide-phone"
              class="size-4 shrink-0"
            />
            {{ profile.phone }}
          </p>
        </div>
      </section>

      <form
        class="mt-6 space-y-6"
        method="post"
        @submit.prevent="onSubmit"
      >
        <AuthAlert
          v-if="formError"
          :description="formError"
        />

        <div class="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
          <section class="account-panel p-5 sm:p-6">
            <h2 class="flex items-center gap-2 font-semibold text-[#12201a]">
              <UIcon
                name="i-lucide-user-round"
                class="size-4 text-[#5c6a64]"
              />
              Personal details
            </h2>
            <p class="mt-0.5 text-sm text-[#5c6a64]">
              Use your legal name so it matches your ID.
            </p>

            <div class="mt-5 grid gap-4 sm:grid-cols-2">
              <div class="min-w-0">
                <label
                  for="firstName"
                  class="mb-1.5 block text-xs font-medium text-[#5c6a64]"
                >First name</label>
                <UInput
                  id="firstName"
                  v-model="form.firstName"
                  size="lg"
                  class="w-full"
                  autocomplete="given-name"
                  :disabled="pending"
                />
                <p
                  v-if="errors.firstName"
                  class="mt-1 text-xs text-red-700"
                >
                  {{ errors.firstName }}
                </p>
              </div>
              <div class="min-w-0">
                <label
                  for="lastName"
                  class="mb-1.5 block text-xs font-medium text-[#5c6a64]"
                >Last name</label>
                <UInput
                  id="lastName"
                  v-model="form.lastName"
                  size="lg"
                  class="w-full"
                  autocomplete="family-name"
                  :disabled="pending"
                />
                <p
                  v-if="errors.lastName"
                  class="mt-1 text-xs text-red-700"
                >
                  {{ errors.lastName }}
                </p>
              </div>
              <div class="min-w-0 sm:col-span-2">
                <label
                  for="phone"
                  class="mb-1.5 block text-xs font-medium text-[#5c6a64]"
                >Mobile number</label>
                <UInput
                  id="phone"
                  v-model="form.phone"
                  type="tel"
                  size="lg"
                  autocomplete="tel"
                  placeholder="09XX XXX XXXX"
                  icon="i-lucide-phone"
                  class="w-full"
                  :disabled="pending"
                />
                <p
                  v-if="errors.phone"
                  class="mt-1 text-xs text-red-700"
                >
                  {{ errors.phone }}
                </p>
              </div>
              <div class="min-w-0 sm:col-span-2">
                <p class="mb-1.5 text-xs font-medium text-[#5c6a64]">
                  Email
                </p>
                <div class="flex items-center gap-2 rounded-lg border border-[#12201a]/8 bg-[#f4f6f5] px-3 py-2.5 text-sm text-[#3b4a44]">
                  <UIcon
                    name="i-lucide-lock"
                    class="size-4 shrink-0 text-[#5c6a64]"
                  />
                  <span class="min-w-0 flex-1 break-all">{{ profile?.email || '—' }}</span>
                </div>
                <p class="mt-1 text-xs text-[#5c6a64]">
                  Your email comes from your sign-in account and cannot be changed here.
                </p>
              </div>
            </div>
          </section>

          <section class="account-panel p-5 sm:p-6">
            <h2 class="flex items-center gap-2 font-semibold text-[#12201a]">
              <UIcon
                name="i-lucide-shield-check"
                class="size-4 text-[#5c6a64]"
              />
              Policies & preferences
            </h2>

            <ul class="mt-4 space-y-3">
              <li class="rounded-xl border border-[#12201a]/8 p-4 text-sm">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-medium text-[#12201a]">
                      Terms & Conditions
                    </p>
                    <p
                      v-if="profile?.termsVersion"
                      class="mt-0.5 text-xs text-[#5c6a64]"
                    >
                      {{ profile.termsVersion }}<template v-if="profile.termsAcceptedAt">
                        · accepted {{ formatBusinessDateTime(profile.termsAcceptedAt) }}
                      </template>
                    </p>
                  </div>
                  <span
                    class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    :class="profile?.termsVersion ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
                  >
                    <UIcon
                      :name="profile?.termsVersion ? 'i-lucide-check' : 'i-lucide-clock'"
                      class="size-3"
                    />
                    {{ profile?.termsVersion ? 'Accepted' : 'Needed' }}
                  </span>
                </div>
                <label
                  v-if="!profile?.termsVersion"
                  class="mt-3 flex items-start gap-3 text-[#3b4a44]"
                >
                  <input
                    v-model="form.termsAccepted"
                    type="checkbox"
                    class="mt-1 size-4 accent-[#12201a]"
                    :disabled="pending"
                  >
                  <span>
                    I have read and agree to the
                    <NuxtLink
                      to="/terms"
                      class="font-medium text-[#12201a] underline underline-offset-4"
                    >Terms & Conditions</NuxtLink>
                    ({{ CURRENT_TERMS_VERSION }}).
                  </span>
                </label>
                <NuxtLink
                  v-else
                  to="/terms"
                  class="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#12201a] hover:underline"
                >
                  Read the current terms
                  <UIcon
                    name="i-lucide-arrow-up-right"
                    class="size-3"
                  />
                </NuxtLink>
              </li>

              <li class="rounded-xl border border-[#12201a]/8 p-4 text-sm">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-medium text-[#12201a]">
                      Privacy Policy
                    </p>
                    <p
                      v-if="profile?.privacyPolicyVersion"
                      class="mt-0.5 text-xs text-[#5c6a64]"
                    >
                      {{ profile.privacyPolicyVersion }}<template v-if="profile.privacyAcceptedAt">
                        · acknowledged {{ formatBusinessDateTime(profile.privacyAcceptedAt) }}
                      </template>
                    </p>
                  </div>
                  <span
                    class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    :class="profile?.privacyPolicyVersion ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
                  >
                    <UIcon
                      :name="profile?.privacyPolicyVersion ? 'i-lucide-check' : 'i-lucide-clock'"
                      class="size-3"
                    />
                    {{ profile?.privacyPolicyVersion ? 'Acknowledged' : 'Needed' }}
                  </span>
                </div>
                <label
                  v-if="!profile?.privacyPolicyVersion"
                  class="mt-3 flex items-start gap-3 text-[#3b4a44]"
                >
                  <input
                    v-model="form.privacyAcknowledged"
                    type="checkbox"
                    class="mt-1 size-4 accent-[#12201a]"
                    :disabled="pending"
                  >
                  <span>
                    I acknowledge the
                    <NuxtLink
                      to="/privacy"
                      class="font-medium text-[#12201a] underline underline-offset-4"
                    >Privacy Policy</NuxtLink>
                    ({{ CURRENT_PRIVACY_POLICY_VERSION }}).
                  </span>
                </label>
                <NuxtLink
                  v-else
                  to="/privacy"
                  class="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#12201a] hover:underline"
                >
                  Read the current privacy policy
                  <UIcon
                    name="i-lucide-arrow-up-right"
                    class="size-3"
                  />
                </NuxtLink>
              </li>

              <li class="rounded-xl border border-[#12201a]/8 p-4 text-sm">
                <label class="flex items-start justify-between gap-4">
                  <span class="min-w-0">
                    <span class="block font-medium text-[#12201a]">Promotions and announcements</span>
                    <span class="mt-0.5 block text-xs text-[#5c6a64]">Get promotions, rental announcements, and special offers from JRY Rentals.</span>
                  </span>
                  <USwitch
                    v-model="form.marketingOptIn"
                    :disabled="pending"
                    aria-label="Receive promotions and announcements"
                  />
                </label>
              </li>
            </ul>
          </section>
        </div>

        <div class="account-panel sticky bottom-20 z-10 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
          <p
            class="flex items-center gap-2 text-sm"
            :class="dirty ? 'text-amber-700' : 'text-[#5c6a64]'"
          >
            <UIcon
              :name="dirty ? 'i-lucide-circle-dot' : 'i-lucide-circle-check'"
              class="size-4 shrink-0"
            />
            {{ dirty ? 'You have unsaved changes' : 'All changes saved' }}
          </p>
          <div class="flex flex-col-reverse gap-2 sm:flex-row">
            <UButton
              v-if="dirty"
              type="button"
              color="neutral"
              variant="ghost"
              class="justify-center rounded-full"
              :disabled="pending"
              @click="resetForm"
            >
              Discard
            </UButton>
            <UButton
              type="submit"
              size="lg"
              icon="i-lucide-save"
              class="justify-center rounded-full"
              :loading="pending"
              :disabled="!dirty"
            >
              Save changes
            </UButton>
          </div>
        </div>
      </form>
    </section>
  </div>
</template>
