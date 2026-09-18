<script setup lang="ts">
import type { PublicMaintenanceStatus } from '~/types/maintenance'
import { DEFAULT_MAINTENANCE_MESSAGE, DEFAULT_MAINTENANCE_TITLE, fallbackMaintenanceProducts } from '~/utils/maintenance'

definePageMeta({
  layout: 'blank',
})

const { data } = await useFetch<PublicMaintenanceStatus>('/api/maintenance')

const title = computed(() => data.value?.title || DEFAULT_MAINTENANCE_TITLE)
const message = computed(() => data.value?.message || DEFAULT_MAINTENANCE_MESSAGE)
const images = computed(() => data.value?.images ?? [])
const products = computed(() => data.value?.products?.length ? data.value.products : fallbackMaintenanceProducts())

useSiteMeta({
  title: 'Maintenance',
  description: message.value,
  path: '/maintenance',
  robots: 'noindex, nofollow',
})
</script>

<template>
  <MaintenanceScreen
    :title="title"
    :message="message"
    :images="images"
    :products="products"
  />
</template>
