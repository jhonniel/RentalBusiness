<template>
  <UApp :toaster="{ position: 'top-center' }">
    <NuxtLoadingIndicator color="#0B5FFF" />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
