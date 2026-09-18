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
    <section class="flex min-w-0 flex-1 flex-col px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
      <header class="min-w-0">
        <p class="text-sm font-medium text-[#5c6a64]">
          Account
        </p>
        <h1 class="mt-0.5 text-xl font-semibold break-words text-[#12201a] sm:text-2xl">
          Profile
        </h1>
        <p class="mt-1 text-sm text-[#5c6a64]">
          Email comes from your signed-in account.
        </p>
      </header>

      <form
        class="account-panel mt-5 w-full min-w-0 p-4 sm:p-6"
        method="post"
        @submit.prevent="onSubmit"
      >
        <dl class="grid gap-1 text-sm sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
          <dt class="text-[#5c6a64]">
            Email
          </dt>
          <dd class="min-w-0 break-all font-medium text-[#12201a]">
            {{ profile?.email || '—' }}
          </dd>
        </dl>

        <AuthAlert
          v-if="formError"
          class="mt-6"
          :description="formError"
        />

        <div class="mt-6 grid gap-4 sm:grid-cols-2">
          <div class="min-w-0">
            <label
              for="firstName"
              class="mb-1.5 block text-sm text-[#3b4a44]"
            >First name</label>
            <UInput
              id="firstName"
              v-model="form.firstName"
              class="w-full"
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
              class="mb-1.5 block text-sm text-[#3b4a44]"
            >Last name</label>
            <UInput
              id="lastName"
              v-model="form.lastName"
              class="w-full"
              :disabled="pending"
            />
            <p
              v-if="errors.lastName"
              class="mt-1 text-xs text-red-700"
            >
              {{ errors.lastName }}
            </p>
          </div>
          <div class="min-w-0 sm:col-span-2 sm:max-w-md">
            <label
              for="phone"
              class="mb-1.5 block text-sm text-[#3b4a44]"
            >Phone</label>
            <UInput
              id="phone"
              v-model="form.phone"
              type="tel"
              autocomplete="tel"
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
        </div>

        <div class="mt-6 grid gap-4 lg:grid-cols-2">
          <div class="rounded-xl bg-[#f7f8f7] p-4 text-sm">
            <p class="text-[#5c6a64]">
              Terms & Conditions
            </p>
            <p class="mt-1 break-words text-[#12201a]">
              {{ profile?.termsVersion
                ? `${profile.termsVersion} · accepted ${profile.termsAcceptedAt ? formatBusinessDateTime(profile.termsAcceptedAt) : ''}`
                : 'Not yet accepted' }}
            </p>
            <label
              v-if="!profile?.termsVersion"
              class="mt-3 flex items-start gap-3 text-[#3b4a44]"
            >
              <input
                v-model="form.termsAccepted"
                type="checkbox"
                class="mt-1"
                :disabled="pending"
              >
              <span>
                I have read and agree to the
                <NuxtLink
                  to="/terms"
                  class="font-medium text-[#12201a] underline-offset-4 hover:underline"
                >Terms & Conditions</NuxtLink>
                ({{ CURRENT_TERMS_VERSION }}).
              </span>
            </label>
            <p
              v-else
              class="mt-2"
            >
              <NuxtLink
                to="/terms"
                class="font-medium text-[#12201a] underline-offset-4 hover:underline"
              >Read the current Terms & Conditions</NuxtLink>
            </p>
          </div>

          <div class="rounded-xl bg-[#f7f8f7] p-4 text-sm">
            <p class="text-[#5c6a64]">
              Privacy Policy
            </p>
            <p class="mt-1 break-words text-[#12201a]">
              {{ profile?.privacyPolicyVersion
                ? `${profile.privacyPolicyVersion} · accepted ${profile.privacyAcceptedAt ? formatBusinessDateTime(profile.privacyAcceptedAt) : ''}`
                : 'Not yet acknowledged' }}
            </p>
            <label
              v-if="!profile?.privacyPolicyVersion"
              class="mt-3 flex items-start gap-3 text-[#3b4a44]"
            >
              <input
                v-model="form.privacyAcknowledged"
                type="checkbox"
                class="mt-1"
                :disabled="pending"
              >
              <span>
                I acknowledge the
                <NuxtLink
                  to="/privacy"
                  class="font-medium text-[#12201a] underline-offset-4 hover:underline"
                >Privacy Policy</NuxtLink>
                ({{ CURRENT_PRIVACY_POLICY_VERSION }}).
              </span>
            </label>
            <p
              v-else
              class="mt-2"
            >
              <NuxtLink
                to="/privacy"
                class="font-medium text-[#12201a] underline-offset-4 hover:underline"
              >Read the current Privacy Policy</NuxtLink>
            </p>
          </div>
        </div>

        <label class="mt-6 flex items-start gap-3 text-sm text-[#3b4a44]">
          <input
            v-model="form.marketingOptIn"
            type="checkbox"
            class="mt-1"
            :disabled="pending"
          >
          <span>I would like to receive promotions, rental announcements, and special offers from JRY Rentals.</span>
        </label>

        <UButton
          type="submit"
          class="mt-6 w-full justify-center sm:w-auto"
          :loading="pending"
        >
          Save changes
        </UButton>
      </form>
    </section>
  </div>
</template>
