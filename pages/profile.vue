<script setup lang="ts">
import { fieldErrors, updateProfileSchema } from '~/utils/auth-validation'
import { CURRENT_PRIVACY_POLICY_VERSION } from '~/utils/privacy-policy'
import { CURRENT_TERMS_VERSION } from '~/utils/terms'
import { formatBusinessDateTime } from '~/utils/datetime'

definePageMeta({
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
  <section class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
    <AccountNav />

    <h1 class="mt-8 text-3xl font-semibold tracking-tight text-slate-900">
      Profile
    </h1>
    <p class="mt-2 max-w-2xl text-stone-600">
      Email comes from your signed-in account. Role cannot be changed here.
    </p>

    <div class="mt-8 max-w-xl rounded-xl border border-stone-200 bg-white p-6">
      <dl class="grid gap-3 text-sm">
        <div class="flex justify-between gap-4">
          <dt class="text-stone-500">
            Email
          </dt>
          <dd class="text-stone-900">
            {{ profile?.email || '—' }}
          </dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-stone-500">
            Role
          </dt>
          <dd class="capitalize text-stone-900">
            {{ profile?.role || 'customer' }}
          </dd>
        </div>
      </dl>

      <AuthAlert
        v-if="formError"
        class="mt-6"
        :description="formError"
      />

      <form
        class="mt-6 space-y-4"
        method="post"
        @submit.prevent="onSubmit"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              for="firstName"
              class="mb-1.5 block text-sm text-stone-700"
            >First name</label>
            <UInput
              id="firstName"
              v-model="form.firstName"
              :disabled="pending"
            />
            <p
              v-if="errors.firstName"
              class="mt-1 text-xs text-red-700"
            >
              {{ errors.firstName }}
            </p>
          </div>
          <div>
            <label
              for="lastName"
              class="mb-1.5 block text-sm text-stone-700"
            >Last name</label>
            <UInput
              id="lastName"
              v-model="form.lastName"
              :disabled="pending"
            />
            <p
              v-if="errors.lastName"
              class="mt-1 text-xs text-red-700"
            >
              {{ errors.lastName }}
            </p>
          </div>
        </div>

        <div class="rounded-lg border border-stone-100 bg-stone-50 p-3 text-sm">
          <p class="text-stone-500">
            Terms & Conditions
          </p>
          <p class="mt-1 text-stone-800">
            {{ profile?.termsVersion
              ? `${profile.termsVersion} · accepted ${profile.termsAcceptedAt ? formatBusinessDateTime(profile.termsAcceptedAt) : ''}`
              : 'Not yet accepted' }}
          </p>
          <label
            v-if="!profile?.termsVersion"
            class="mt-3 flex items-start gap-3 text-stone-700"
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

        <div class="rounded-lg border border-stone-100 bg-stone-50 p-3 text-sm">
          <p class="text-stone-500">
            Privacy Policy
          </p>
          <p class="mt-1 text-stone-800">
            {{ profile?.privacyPolicyVersion
              ? `${profile.privacyPolicyVersion} · accepted ${profile.privacyAcceptedAt ? formatBusinessDateTime(profile.privacyAcceptedAt) : ''}`
              : 'Not yet acknowledged' }}
          </p>
          <label
            v-if="!profile?.privacyPolicyVersion"
            class="mt-3 flex items-start gap-3 text-stone-700"
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

        <label class="flex items-start gap-3 text-sm text-stone-700">
          <input
            v-model="form.marketingOptIn"
            type="checkbox"
            class="mt-1"
            :disabled="pending"
          >
          <span>I would like to receive promotions, rental announcements, and special offers from JRY Rentals.</span>
        </label>

        <div>
          <label
            for="phone"
            class="mb-1.5 block text-sm text-stone-700"
          >Phone</label>
          <UInput
            id="phone"
            v-model="form.phone"
            type="tel"
            autocomplete="tel"
            :disabled="pending"
          />
          <p
            v-if="errors.phone"
            class="mt-1 text-xs text-red-700"
          >
            {{ errors.phone }}
          </p>
        </div>

        <UButton
          type="submit"
          :loading="pending"
        >
          Save changes
        </UButton>
      </form>
    </div>
  </section>
</template>
