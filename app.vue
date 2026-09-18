<script setup lang="ts">
const route = useRoute()

const showSupportChat = computed(() => {
  const layout = route.meta.layout
  return !layout || layout === 'default'
})

const showCookieBanner = computed(() => route.meta.layout !== 'admin')
</script>

<template>
  <UApp :toaster="{ position: 'top-center' }">
    <NuxtLoadingIndicator color="#0B5FFF" />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <MaintenanceChat
      v-if="showSupportChat"
      variant="float"
      mode="live"
    />
    <ClientOnly>
      <CookieConsentBanner v-if="showCookieBanner" />
    </ClientOnly>
  </UApp>
</template>
