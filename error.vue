<script setup lang="ts">
import type { NuxtError } from '#app'
import { APP_NAME } from '~/utils/constants'

const props = defineProps<{
  error: NuxtError
}>()

const isNotFound = computed(() => props.error.statusCode === 404)
const isForbidden = computed(() => props.error.statusCode === 403)

const title = computed(() => {
  if (isNotFound.value) {
    return 'Page not found'
  }

  if (isForbidden.value) {
    return 'Access denied'
  }

  return 'Something went wrong'
})
const description = computed(() => {
  if (isNotFound.value) {
    return 'The page you are looking for does not exist or has been moved.'
  }

  if (isForbidden.value) {
    return 'You do not have permission to view this page.'
  }

  return 'We could not complete that request. Please try again.'
})

useSeoMeta({
  title: `${title.value} · ${APP_NAME}`,
  description: description.value,
  robots: 'noindex, nofollow',
})

function handleClear() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <UApp>
    <div class="flex min-h-dvh flex-col bg-stone-50">
      <div class="px-4 py-5 sm:px-6">
        <AppLogo />
      </div>
      <main class="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 pb-16 text-center">
        <p class="text-xs uppercase tracking-widest text-stone-500">
          {{ error.statusCode }}
        </p>
        <h1 class="font-display mt-4 text-3xl tracking-normal text-stone-900 sm:text-4xl">
          {{ title }}
        </h1>
        <p class="mt-4 tracking-normal text-stone-600">
          {{ description }}
        </p>
        <div class="mt-8 flex justify-center">
          <UButton @click="handleClear">
            Back to home
          </UButton>
        </div>
      </main>
    </div>
  </UApp>
</template>
