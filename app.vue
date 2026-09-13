<template>
  <UApp :toaster="{ position: 'top-right' }">
    <NuxtLoadingIndicator color="#0B5FFF" />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
