<script setup lang="ts">
import type { AdminSocialLinkListResponse, PublicSocialAd, PublicSocialLink } from '~/types/social-link'
import type { VoucherListResponse } from '~/types/voucher'
import { IMAGE_UPLOAD_ACCEPT, IMAGE_UPLOAD_HELP } from '~/utils/image-upload'
import { qrSvg } from '~/utils/qr'
import {
  DEFAULT_SOCIAL_BUTTON_COLOR,
  SOCIAL_BUTTON_ICONS,
  resolveSocialButtonColor,
  socialButtonIconName,
  socialButtonTextColor,
} from '~/utils/social-link'
import {
  socialAdInputSchema,
  socialLinkInputSchema,
  socialPageAppearanceSchema,
} from '~/utils/social-link-validation'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Social Media',
  path: '/admin/social-media',
})

const toast = useToast()
const { data, error, pending, refresh } = await useFetch<AdminSocialLinkListResponse>('/api/admin/social-links')
const { data: voucherData } = await useFetch<VoucherListResponse>('/api/admin/vouchers', {
  query: { status: 'active', page: 1, pageSize: 50 },
})

const unavailable = computed(() => error.value?.statusCode === 503)
const ready = computed(() => data.value?.ready ?? false)
const adsReady = computed(() => data.value?.adsReady ?? false)
const items = computed(() => data.value?.items ?? [])
const ads = computed(() => data.value?.ads ?? [])
const pageUrl = computed(() => data.value?.pageUrl || '')
const pagePath = computed(() => {
  try {
    return pageUrl.value ? new URL(pageUrl.value).pathname : ''
  }
  catch {
    return ''
  }
})
const pageButtonColor = ref(DEFAULT_SOCIAL_BUTTON_COLOR)
const pageButtonTextColor = computed(() => socialButtonTextColor(pageButtonColor.value))
const savingColor = ref(false)
const colorError = ref('')

watch(() => data.value?.buttonColor, (value) => {
  if (value) {
    pageButtonColor.value = value
  }
}, { immediate: true })

const form = reactive({
  label: '',
  url: '',
  sortOrder: 0,
  isActive: true,
  buttonColor: '' as string,
  icon: '' as string,
})
const editingUuid = ref<string | null>(null)
const formError = ref('')
const saving = ref(false)
const busyUuid = ref<string | null>(null)
const rotating = ref(false)
const deleteLinkConfirmOpen = ref(false)
const pendingDeleteLink = ref<PublicSocialLink | null>(null)
const deleteAdConfirmOpen = ref(false)
const pendingDeleteAd = ref<PublicSocialAd | null>(null)
const rotateConfirmOpen = ref(false)
const removeAdImageConfirmOpen = ref(false)

const adForm = reactive({
  title: '',
  subtitle: '',
  linkUrl: '',
  voucherUuid: '' as string,
  sortOrder: 0,
  isActive: true,
})
const editingAdUuid = ref<string | null>(null)
const adFormError = ref('')
const savingAd = ref(false)
const busyAdUuid = ref<string | null>(null)
const adImageFile = ref<File | null>(null)
const adImageInput = ref<HTMLInputElement | null>(null)

const voucherOptions = computed(() => [
  { label: 'No voucher', value: '' },
  ...(voucherData.value?.items || []).map(voucher => ({
    label: `${voucher.code} · ${voucher.name}`,
    value: voucher.uuid,
  })),
])

const editingAdImageUrl = computed(() => {
  if (!editingAdUuid.value) {
    return null
  }
  return ads.value.find(ad => ad.uuid === editingAdUuid.value)?.imageUrl ?? null
})

const qrMarkup = computed(() => pageUrl.value ? qrSvg(pageUrl.value) : '')

function nextSortOrder() {
  return items.value.reduce((max, link) => Math.max(max, link.sortOrder), 0) + 10
}

function nextAdSortOrder() {
  return ads.value.reduce((max, ad) => Math.max(max, ad.sortOrder), 0) + 10
}

function resetForm() {
  editingUuid.value = null
  form.label = ''
  form.url = ''
  form.sortOrder = nextSortOrder()
  form.isActive = true
  form.buttonColor = ''
  form.icon = ''
  formError.value = ''
}

function resetAdForm() {
  editingAdUuid.value = null
  adForm.title = ''
  adForm.subtitle = ''
  adForm.linkUrl = ''
  adForm.voucherUuid = ''
  adForm.sortOrder = nextAdSortOrder()
  adForm.isActive = true
  adFormError.value = ''
  adImageFile.value = null
  if (adImageInput.value) {
    adImageInput.value.value = ''
  }
}

watch(items, () => {
  if (!editingUuid.value && !form.label && !form.url) {
    form.sortOrder = nextSortOrder()
  }
}, { immediate: true })

watch(ads, () => {
  if (!editingAdUuid.value && !adForm.title && !adForm.linkUrl && !adForm.voucherUuid) {
    adForm.sortOrder = nextAdSortOrder()
  }
}, { immediate: true })

function startEdit(link: PublicSocialLink) {
  editingUuid.value = link.uuid
  form.label = link.label
  form.url = link.url
  form.sortOrder = link.sortOrder
  form.isActive = link.isActive
  form.buttonColor = link.buttonColor || ''
  form.icon = link.icon || ''
  formError.value = ''
}

function startEditAd(ad: PublicSocialAd) {
  editingAdUuid.value = ad.uuid
  adForm.title = ad.title
  adForm.subtitle = ad.subtitle || ''
  adForm.linkUrl = ad.linkUrl || ''
  adForm.voucherUuid = ad.voucher?.uuid || ''
  adForm.sortOrder = ad.sortOrder
  adForm.isActive = ad.isActive
  adFormError.value = ''
  adImageFile.value = null
  if (adImageInput.value) {
    adImageInput.value.value = ''
  }
}

function onAdImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  adImageFile.value = input.files?.[0] ?? null
}

function errorMessage(caught: unknown, fallback: string) {
  const payload = typeof caught === 'object' && caught && 'data' in caught
    ? (caught as { data?: { message?: string } }).data
    : null
  return payload?.message || fallback
}

function linkPayload(link: PublicSocialLink, changes: Partial<PublicSocialLink> & { buttonColor?: string | null, icon?: string | null }) {
  return {
    label: changes.label ?? link.label,
    url: changes.url ?? link.url,
    sortOrder: changes.sortOrder ?? link.sortOrder,
    isActive: changes.isActive ?? link.isActive,
    buttonColor: changes.buttonColor !== undefined
      ? changes.buttonColor
      : (link.buttonColor ?? null),
    icon: changes.icon !== undefined
      ? changes.icon
      : (link.icon ?? null),
  }
}

function patchLink(link: PublicSocialLink, changes: Partial<PublicSocialLink> & { buttonColor?: string | null, icon?: string | null }) {
  return $fetch<PublicSocialLink>(`/api/admin/social-links/${link.uuid}`, {
    method: 'PATCH',
    body: linkPayload(link, changes),
  })
}

function adPayload(ad: PublicSocialAd, changes: Partial<{
  title: string
  subtitle: string | null
  linkUrl: string | null
  voucherUuid: string | null
  sortOrder: number
  isActive: boolean
}>) {
  return {
    title: changes.title ?? ad.title,
    subtitle: changes.subtitle !== undefined ? changes.subtitle : ad.subtitle,
    linkUrl: changes.linkUrl !== undefined ? changes.linkUrl : ad.linkUrl,
    voucherUuid: changes.voucherUuid !== undefined ? changes.voucherUuid : (ad.voucher?.uuid ?? null),
    sortOrder: changes.sortOrder ?? ad.sortOrder,
    isActive: changes.isActive ?? ad.isActive,
  }
}

function patchAd(ad: PublicSocialAd, changes: Parameters<typeof adPayload>[1]) {
  return $fetch<PublicSocialAd>(`/api/admin/social-ads/${ad.uuid}`, {
    method: 'PATCH',
    body: adPayload(ad, changes),
  })
}

async function uploadAdImage(uuid: string) {
  if (!adImageFile.value) {
    return
  }
  const body = new FormData()
  body.append('file', adImageFile.value)
  await $fetch(`/api/admin/social-ads/${uuid}/image`, {
    method: 'POST',
    body,
  })
}

async function onSubmit() {
  formError.value = ''
  const parsed = socialLinkInputSchema.safeParse({
    ...form,
    buttonColor: form.buttonColor.trim() || null,
    icon: form.icon || null,
  })
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message || 'Check the button.'
    return
  }

  saving.value = true
  try {
    await (editingUuid.value
      ? $fetch<PublicSocialLink>(`/api/admin/social-links/${editingUuid.value}`, { method: 'PATCH', body: parsed.data })
      : $fetch<PublicSocialLink>('/api/admin/social-links', { method: 'POST', body: parsed.data }))
    toast.add({ title: editingUuid.value ? 'Button updated' : 'Button added', color: 'success' })
    await refresh()
    resetForm()
  }
  catch (caught) {
    formError.value = errorMessage(caught, 'We could not save that button.')
  }
  finally {
    saving.value = false
  }
}

async function onAdSubmit() {
  adFormError.value = ''
  const parsed = socialAdInputSchema.safeParse({
    title: adForm.title,
    subtitle: adForm.subtitle || null,
    linkUrl: adForm.linkUrl || null,
    voucherUuid: adForm.voucherUuid || null,
    sortOrder: adForm.sortOrder,
    isActive: adForm.isActive,
  })
  if (!parsed.success) {
    adFormError.value = parsed.error.issues[0]?.message || 'Check the promotion.'
    return
  }

  const existingImage = Boolean(editingAdImageUrl.value)
  if (parsed.data.isActive && !parsed.data.voucherUuid && !existingImage && !adImageFile.value) {
    adFormError.value = 'Upload a promo image or choose a voucher before showing this ad.'
    return
  }

  savingAd.value = true
  try {
    const creating = !editingAdUuid.value
    // Image uploads after save; keep inactive until the file is stored when that is the only content.
    const deferActivate = parsed.data.isActive
      && !parsed.data.voucherUuid
      && !existingImage
      && Boolean(adImageFile.value)
    const saveBody = deferActivate || (creating && !parsed.data.voucherUuid)
      ? { ...parsed.data, isActive: false }
      : parsed.data

    const saved = editingAdUuid.value
      ? await $fetch<PublicSocialAd>(`/api/admin/social-ads/${editingAdUuid.value}`, { method: 'PATCH', body: saveBody })
      : await $fetch<PublicSocialAd>('/api/admin/social-ads', { method: 'POST', body: saveBody })
    if (adImageFile.value) {
      await uploadAdImage(saved.uuid)
    }
    if (parsed.data.isActive && (parsed.data.voucherUuid || existingImage || adImageFile.value)) {
      await $fetch(`/api/admin/social-ads/${saved.uuid}`, {
        method: 'PATCH',
        body: { ...parsed.data, isActive: true },
      })
    }
    toast.add({ title: editingAdUuid.value ? 'Promotion updated' : 'Promotion added', color: 'success' })
    await refresh()
    resetAdForm()
  }
  catch (caught) {
    adFormError.value = errorMessage(caught, 'We could not save that promotion.')
  }
  finally {
    savingAd.value = false
  }
}

function askRemoveAdImage() {
  if (!editingAdUuid.value) {
    return
  }
  removeAdImageConfirmOpen.value = true
}

async function removeAdImage() {
  if (!editingAdUuid.value) {
    return
  }
  adFormError.value = ''
  busyAdUuid.value = editingAdUuid.value
  try {
    await $fetch(`/api/admin/social-ads/${editingAdUuid.value}/image`, { method: 'DELETE' })
    toast.add({ title: 'Promo image removed', color: 'success' })
    adImageFile.value = null
    if (adImageInput.value) {
      adImageInput.value.value = ''
    }
    removeAdImageConfirmOpen.value = false
    await refresh()
  }
  catch (caught) {
    adFormError.value = errorMessage(caught, 'We could not remove that image.')
  }
  finally {
    busyAdUuid.value = null
  }
}

async function toggleActive(link: PublicSocialLink) {
  busyUuid.value = link.uuid
  try {
    await patchLink(link, { isActive: !link.isActive })
    toast.add({ title: link.isActive ? 'Button hidden' : 'Button shown', color: 'success' })
    await refresh()
  }
  catch (caught) {
    toast.add({ title: errorMessage(caught, 'We could not update that button.'), color: 'error' })
  }
  finally {
    busyUuid.value = null
  }
}

async function toggleAdActive(ad: PublicSocialAd) {
  busyAdUuid.value = ad.uuid
  try {
    await patchAd(ad, { isActive: !ad.isActive })
    toast.add({ title: ad.isActive ? 'Promotion hidden' : 'Promotion shown', color: 'success' })
    await refresh()
  }
  catch (caught) {
    toast.add({ title: errorMessage(caught, 'We could not update that promotion.'), color: 'error' })
  }
  finally {
    busyAdUuid.value = null
  }
}

async function move(index: number, direction: -1 | 1) {
  const current = items.value[index]
  const other = items.value[index + direction]
  if (!current || !other) {
    return
  }

  busyUuid.value = current.uuid
  try {
    const currentOrder = current.sortOrder === other.sortOrder ? other.sortOrder + direction : other.sortOrder
    await Promise.all([
      patchLink(current, { sortOrder: Math.max(0, currentOrder) }),
      patchLink(other, { sortOrder: current.sortOrder }),
    ])
    await refresh()
  }
  catch (caught) {
    toast.add({ title: errorMessage(caught, 'We could not reorder the buttons.'), color: 'error' })
  }
  finally {
    busyUuid.value = null
  }
}

async function moveAd(index: number, direction: -1 | 1) {
  const current = ads.value[index]
  const other = ads.value[index + direction]
  if (!current || !other) {
    return
  }

  busyAdUuid.value = current.uuid
  try {
    const currentOrder = current.sortOrder === other.sortOrder ? other.sortOrder + direction : other.sortOrder
    await Promise.all([
      patchAd(current, { sortOrder: Math.max(0, currentOrder) }),
      patchAd(other, { sortOrder: current.sortOrder }),
    ])
    await refresh()
  }
  catch (caught) {
    toast.add({ title: errorMessage(caught, 'We could not reorder the promotions.'), color: 'error' })
  }
  finally {
    busyAdUuid.value = null
  }
}

function askRemoveLink(link: PublicSocialLink) {
  pendingDeleteLink.value = link
  deleteLinkConfirmOpen.value = true
}

async function removeLink() {
  const link = pendingDeleteLink.value
  if (!link) {
    return
  }

  busyUuid.value = link.uuid
  try {
    await $fetch(`/api/admin/social-links/${link.uuid}`, { method: 'DELETE' })
    toast.add({ title: 'Button deleted', color: 'success' })
    if (editingUuid.value === link.uuid) {
      resetForm()
    }
    deleteLinkConfirmOpen.value = false
    pendingDeleteLink.value = null
    await refresh()
  }
  catch (caught) {
    toast.add({ title: errorMessage(caught, 'We could not delete that button.'), color: 'error' })
  }
  finally {
    busyUuid.value = null
  }
}

function askRemoveAd(ad: PublicSocialAd) {
  pendingDeleteAd.value = ad
  deleteAdConfirmOpen.value = true
}

async function removeAd() {
  const ad = pendingDeleteAd.value
  if (!ad) {
    return
  }

  busyAdUuid.value = ad.uuid
  try {
    await $fetch(`/api/admin/social-ads/${ad.uuid}`, { method: 'DELETE' })
    toast.add({ title: 'Promotion deleted', color: 'success' })
    if (editingAdUuid.value === ad.uuid) {
      resetAdForm()
    }
    deleteAdConfirmOpen.value = false
    pendingDeleteAd.value = null
    await refresh()
  }
  catch (caught) {
    toast.add({ title: errorMessage(caught, 'We could not delete that promotion.'), color: 'error' })
  }
  finally {
    busyAdUuid.value = null
  }
}

async function copyPageUrl() {
  if (!pageUrl.value || !import.meta.client) {
    return
  }
  try {
    await navigator.clipboard.writeText(pageUrl.value)
    toast.add({ title: 'Link copied', color: 'success' })
  }
  catch {
    toast.add({ title: 'Could not copy the link.', color: 'error' })
  }
}

function askRotatePageLink() {
  rotateConfirmOpen.value = true
}

async function rotatePageLink() {
  rotating.value = true
  try {
    await $fetch('/api/admin/social-links/rotate', { method: 'POST' })
    toast.add({ title: 'New unique link ready', color: 'success' })
    rotateConfirmOpen.value = false
    await refresh()
  }
  catch (caught) {
    toast.add({ title: errorMessage(caught, 'We could not create a new link.'), color: 'error' })
  }
  finally {
    rotating.value = false
  }
}

async function saveButtonColor() {
  colorError.value = ''
  const parsed = socialPageAppearanceSchema.safeParse({ buttonColor: pageButtonColor.value })
  if (!parsed.success) {
    colorError.value = parsed.error.issues[0]?.message || 'Choose a valid color.'
    return
  }

  savingColor.value = true
  try {
    await $fetch('/api/admin/social-links/appearance', {
      method: 'PATCH',
      body: parsed.data,
    })
    toast.add({ title: 'Default button color saved', color: 'success' })
    await refresh()
  }
  catch (caught) {
    colorError.value = errorMessage(caught, 'We could not save that color.')
  }
  finally {
    savingColor.value = false
  }
}

function previewColor(link: PublicSocialLink) {
  return resolveSocialButtonColor(link.buttonColor, pageButtonColor.value)
}

function printQr() {
  if (!import.meta.client) {
    return
  }
  window.print()
}
</script>

<template>
  <div class="w-full space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <AdminPageHeader
        eyebrow="Marketing"
        title="Social Media"
        description="Build the buttons and promotions on your public links page. The QR code opens that page so people can tap Facebook, Instagram, or claim a voucher."
      />
      <UButton
        :to="pagePath || undefined"
        target="_blank"
        color="neutral"
        variant="outline"
        icon="i-lucide-external-link"
        :disabled="!pagePath"
      >
        View links page
      </UButton>
    </div>

    <AdminNotice
      v-if="unavailable"
      title="Social Media is not connected"
      description="Add live Supabase credentials to manage social links."
    />

    <template v-else>
      <AdminBento>
        <AdminStat
          icon="i-lucide-share-2"
          label="Buttons"
          :value="String(items.length)"
        />
        <AdminStat
          icon="i-lucide-eye"
          label="Shown"
          :value="String(items.filter(link => link.isActive).length)"
          hint="On the unique links page"
        />
        <AdminStat
          icon="i-lucide-megaphone"
          label="Promotions"
          :value="String(ads.filter(ad => ad.isActive).length)"
          hint="Active slides under the buttons"
        />
        <AdminStat
          icon="i-lucide-qr-code"
          label="Public page"
          :value="pagePath || '…'"
          :to="pagePath || undefined"
          tone="accent"
        />
      </AdminBento>

      <AdminNotice
        v-if="data && !ready"
        title="Paste the social links SQL to start editing"
        description="Run supabase/migrations/20261124150000_social_links.sql in the Supabase SQL editor. Until then, the links page uses the starter buttons below."
      />
      <AdminNotice
        v-else-if="data && !adsReady"
        title="Paste the promotions SQL for ads and per-button colors"
        description="Run supabase/migrations/20261124170000_social_button_color_and_ads.sql in the Supabase SQL editor to unlock per-button colors and the promo carousel. For button icons, also run 20261124180000_social_link_icons.sql."
      />

      <div class="grid gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,26rem)_minmax(0,1fr)] xl:items-start">
        <section class="social-qr-card rounded-xl border border-stone-200 bg-white p-5 print:border-0 print:p-0">
          <h3 class="text-sm font-medium text-stone-900 print:text-center">
            QR code
          </h3>
          <p class="mt-1 text-xs text-stone-500 print:hidden">
            Unique URL for this page. Scan or share it; only this link opens your buttons.
          </p>
          <div
            v-if="qrMarkup"
            class="mx-auto mt-4 flex max-w-[14rem] justify-center rounded-xl border border-stone-100 bg-white p-3"
            v-html="qrMarkup"
          />
          <p
            v-else-if="pending"
            class="mt-4 text-sm text-stone-500"
          >
            Loading…
          </p>
          <p class="mt-3 break-all text-center font-mono text-[11px] text-stone-500">
            {{ pageUrl || '…' }}
          </p>
          <div class="mt-4 flex flex-wrap gap-2 print:hidden">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-copy"
              :disabled="!pageUrl"
              @click="copyPageUrl"
            >
              Copy link
            </UButton>
            <UButton
              icon="i-lucide-printer"
              :disabled="!pageUrl"
              @click="printQr"
            >
              Print QR
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-refresh-cw"
              :loading="rotating"
              :disabled="!ready"
              @click="askRotatePageLink"
            >
              New unique link
            </UButton>
          </div>

          <div class="mt-5 border-t border-stone-100 pt-4 print:hidden">
            <h4 class="text-sm font-medium text-stone-900">
              Default button color
            </h4>
            <p class="mt-1 text-xs text-stone-500">
              Used when a button has no custom color of its own.
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <label class="flex items-center gap-2 text-sm text-stone-700">
                <input
                  v-model="pageButtonColor"
                  type="color"
                  class="h-10 w-12 cursor-pointer rounded border border-stone-200 bg-white p-1"
                  :disabled="savingColor || !ready"
                >
                <UInput
                  v-model="pageButtonColor"
                  class="w-28 font-mono text-xs"
                  maxlength="7"
                  :disabled="savingColor || !ready"
                />
              </label>
              <span
                class="inline-flex min-h-10 min-w-28 items-center justify-center rounded-full px-4 text-xs font-medium"
                :style="{ backgroundColor: pageButtonColor, color: pageButtonTextColor }"
              >
                Preview
              </span>
            </div>
            <AuthAlert
              v-if="colorError"
              class="mt-3"
              :description="colorError"
            />
            <UButton
              class="mt-3"
              size="sm"
              :loading="savingColor"
              :disabled="!ready"
              @click="saveButtonColor"
            >
              Save default color
            </UButton>
          </div>
        </section>

        <form
          class="rounded-xl border border-stone-200 bg-white p-5 print:hidden"
          method="post"
          @submit.prevent="onSubmit"
        >
          <h3 class="text-sm font-medium text-stone-900">
            {{ editingUuid ? 'Edit button' : 'New button' }}
          </h3>
          <AuthAlert
            v-if="formError"
            class="mt-4"
            :description="formError"
          />
          <div class="mt-4 space-y-4">
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Label</span>
              <UInput
                v-model="form.label"
                class="w-full"
                maxlength="80"
                placeholder="Facebook"
                :disabled="saving || !ready"
              />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Link</span>
              <UInput
                v-model="form.url"
                class="w-full"
                type="url"
                maxlength="500"
                placeholder="https://www.facebook.com/jryrentals/"
                :disabled="saving || !ready"
              />
            </label>
            <div>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm font-medium text-stone-800">
                  Icon
                </p>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  type="button"
                  :disabled="saving || !ready || !form.icon"
                  @click="form.icon = ''"
                >
                  No icon
                </UButton>
              </div>
              <p class="mt-1 text-xs text-stone-500">
                Optional. Shows beside the label on the public links page.
              </p>
              <div class="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-9">
                <button
                  v-for="option in SOCIAL_BUTTON_ICONS"
                  :key="option.key"
                  type="button"
                  class="inline-flex aspect-square items-center justify-center rounded-lg border transition"
                  :class="form.icon === option.key
                    ? 'border-[#12201a] bg-[#12201a] text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'"
                  :title="option.label"
                  :aria-label="option.label"
                  :aria-pressed="form.icon === option.key"
                  :disabled="saving || !ready"
                  @click="form.icon = form.icon === option.key ? '' : option.key"
                >
                  <UIcon
                    :name="option.lucide"
                    class="size-4"
                  />
                </button>
              </div>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-sm">
                <span class="mb-1.5 block text-stone-700">Order</span>
                <UInput
                  v-model="form.sortOrder"
                  type="number"
                  min="0"
                  step="10"
                  :disabled="saving || !ready"
                />
              </label>
              <div class="flex items-end pb-2 text-sm">
                <USwitch
                  v-model="form.isActive"
                  label="Show on links page"
                  :disabled="saving || !ready"
                />
              </div>
            </div>
            <div class="rounded-lg border border-stone-100 bg-stone-50/80 p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm font-medium text-stone-800">
                  Button color
                </p>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  type="button"
                  :disabled="saving || !ready || !form.buttonColor"
                  @click="form.buttonColor = ''"
                >
                  Use default
                </UButton>
              </div>
              <p class="mt-1 text-xs text-stone-500">
                Optional. Leave blank to use the page default.
              </p>
              <div class="mt-3 flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  class="h-10 w-12 cursor-pointer rounded border border-stone-200 bg-white p-1"
                  :disabled="saving || !ready || !adsReady"
                  :value="form.buttonColor || pageButtonColor"
                  @input="form.buttonColor = ($event.target as HTMLInputElement).value"
                >
                <UInput
                  v-model="form.buttonColor"
                  class="w-28 font-mono text-xs"
                  maxlength="7"
                  placeholder="#1c1917"
                  :disabled="saving || !ready || !adsReady"
                />
                <span
                  class="inline-flex min-h-9 min-w-24 items-center justify-center rounded-full px-3 text-xs font-medium"
                  :style="{
                    backgroundColor: form.buttonColor || pageButtonColor,
                    color: socialButtonTextColor(form.buttonColor || pageButtonColor),
                  }"
                >
                  Preview
                </span>
              </div>
            </div>
          </div>
          <div class="mt-5 flex flex-wrap gap-2">
            <UButton
              type="submit"
              :loading="saving"
              :disabled="!ready"
            >
              {{ editingUuid ? 'Save button' : 'Add button' }}
            </UButton>
            <UButton
              v-if="editingUuid"
              color="neutral"
              variant="outline"
              type="button"
              :disabled="saving"
              @click="resetForm"
            >
              Cancel
            </UButton>
          </div>
        </form>

        <section class="rounded-xl border border-stone-200 bg-white print:hidden">
          <div class="border-b border-stone-100 px-5 py-4">
            <h3 class="text-sm font-medium text-stone-900">
              Buttons
            </h3>
            <p class="mt-1 text-xs text-stone-500">
              Each button can use its own color. Destination links must be unique.
            </p>
          </div>
          <ul
            v-if="items.length"
            class="divide-y divide-stone-100"
          >
            <li
              v-for="(link, index) in items"
              :key="link.uuid"
              class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span
                    class="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-white"
                    :style="{ backgroundColor: previewColor(link) }"
                    :title="link.buttonColor || 'Default color'"
                  >
                    <UIcon
                      v-if="socialButtonIconName(link.icon)"
                      :name="socialButtonIconName(link.icon)!"
                      class="size-3.5"
                    />
                    <span
                      v-else
                      class="size-2 rounded-full bg-white/80"
                    />
                  </span>
                  <p class="font-medium text-stone-900">
                    {{ link.label }}
                    <span
                      v-if="!link.isActive"
                      class="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-normal text-stone-500"
                    >Hidden</span>
                  </p>
                </div>
                <a
                  :href="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="mt-0.5 block truncate text-sm text-lumen-700 hover:text-lumen-800"
                >
                  {{ link.url }}
                </a>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-arrow-up"
                  :disabled="busyUuid === link.uuid || index === 0 || !ready"
                  @click="move(index, -1)"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-arrow-down"
                  :disabled="busyUuid === link.uuid || index === items.length - 1 || !ready"
                  @click="move(index, 1)"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  :disabled="busyUuid === link.uuid || !ready"
                  @click="startEdit(link)"
                >
                  Edit
                </UButton>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  :disabled="busyUuid === link.uuid || !ready"
                  @click="toggleActive(link)"
                >
                  {{ link.isActive ? 'Hide' : 'Show' }}
                </UButton>
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  :disabled="busyUuid === link.uuid || !ready"
                  @click="askRemoveLink(link)"
                >
                  Delete
                </UButton>
              </div>
            </li>
          </ul>
          <p
            v-else
            class="px-5 py-8 text-sm text-stone-500"
          >
            No buttons yet. Add Facebook, Instagram, or any other link.
          </p>
        </section>
      </div>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start print:hidden">
        <form
          class="rounded-xl border border-stone-200 bg-white p-5"
          method="post"
          @submit.prevent="onAdSubmit"
        >
          <h3 class="text-sm font-medium text-stone-900">
            {{ editingAdUuid ? 'Edit promotion' : 'New promotion' }}
          </h3>
          <p class="mt-1 text-xs text-stone-500">
            Shows under the buttons as an image carousel. Attach a promo image and/or a voucher people can use.
          </p>
          <AuthAlert
            v-if="adFormError"
            class="mt-4"
            :description="adFormError"
          />
          <div class="mt-4 space-y-4">
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Title</span>
              <UInput
                v-model="adForm.title"
                class="w-full"
                maxlength="120"
                placeholder="Weekend special"
                :disabled="savingAd || !adsReady"
              />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Subtitle</span>
              <UInput
                v-model="adForm.subtitle"
                class="w-full"
                maxlength="240"
                placeholder="Rent 3 days, get 10% off"
                :disabled="savingAd || !adsReady"
              />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Optional link</span>
              <UInput
                v-model="adForm.linkUrl"
                class="w-full"
                type="url"
                maxlength="500"
                placeholder="https://…"
                :disabled="savingAd || !adsReady"
              />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Voucher</span>
              <select
                v-model="adForm.voucherUuid"
                class="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800"
                :disabled="savingAd || !adsReady"
              >
                <option
                  v-for="option in voucherOptions"
                  :key="option.value || 'none'"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>
            <div>
              <span class="mb-1.5 block text-sm text-stone-700">Promo image</span>
              <input
                ref="adImageInput"
                type="file"
                class="block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-stone-800 hover:file:bg-stone-200"
                :accept="IMAGE_UPLOAD_ACCEPT"
                :disabled="savingAd || !adsReady"
                @change="onAdImageChange"
              >
              <p class="mt-1.5 text-xs text-stone-500">
                {{ IMAGE_UPLOAD_HELP }}
              </p>
              <div
                v-if="editingAdImageUrl"
                class="mt-3 overflow-hidden rounded-lg border border-stone-200"
              >
                <img
                  :src="editingAdImageUrl"
                  alt="Current promo"
                  class="max-h-40 w-full object-cover"
                >
                <div class="border-t border-stone-100 px-3 py-2">
                  <UButton
                    size="xs"
                    color="error"
                    variant="ghost"
                    type="button"
                    :loading="busyAdUuid === editingAdUuid"
                    :disabled="savingAd"
                    @click="askRemoveAdImage"
                  >
                    Remove image
                  </UButton>
                </div>
              </div>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-sm">
                <span class="mb-1.5 block text-stone-700">Order</span>
                <UInput
                  v-model="adForm.sortOrder"
                  type="number"
                  min="0"
                  step="10"
                  :disabled="savingAd || !adsReady"
                />
              </label>
              <div class="flex items-end pb-2 text-sm">
                <USwitch
                  v-model="adForm.isActive"
                  label="Show on links page"
                  :disabled="savingAd || !adsReady"
                />
              </div>
            </div>
          </div>
          <div class="mt-5 flex flex-wrap gap-2">
            <UButton
              type="submit"
              :loading="savingAd"
              :disabled="!adsReady"
            >
              {{ editingAdUuid ? 'Save promotion' : 'Add promotion' }}
            </UButton>
            <UButton
              v-if="editingAdUuid"
              color="neutral"
              variant="outline"
              type="button"
              :disabled="savingAd"
              @click="resetAdForm"
            >
              Cancel
            </UButton>
          </div>
        </form>

        <section class="rounded-xl border border-stone-200 bg-white">
          <div class="border-b border-stone-100 px-5 py-4">
            <h3 class="text-sm font-medium text-stone-900">
              Promotions
            </h3>
            <p class="mt-1 text-xs text-stone-500">
              Active slides rotate under the buttons on the public links page.
            </p>
          </div>
          <ul
            v-if="ads.length"
            class="divide-y divide-stone-100"
          >
            <li
              v-for="(ad, index) in ads"
              :key="ad.uuid"
              class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div class="flex min-w-0 gap-3">
                <div class="h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
                  <img
                    v-if="ad.imageUrl"
                    :src="ad.imageUrl"
                    alt=""
                    class="h-full w-full object-cover"
                  >
                  <div
                    v-else
                    class="flex h-full items-center justify-center text-[10px] uppercase tracking-wide text-stone-400"
                  >
                    No image
                  </div>
                </div>
                <div class="min-w-0">
                  <p class="font-medium text-stone-900">
                    {{ ad.title || 'Untitled promotion' }}
                    <span
                      v-if="!ad.isActive"
                      class="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-normal text-stone-500"
                    >Hidden</span>
                  </p>
                  <p
                    v-if="ad.subtitle"
                    class="mt-0.5 truncate text-sm text-stone-500"
                  >
                    {{ ad.subtitle }}
                  </p>
                  <p
                    v-if="ad.voucher"
                    class="mt-1 text-xs font-medium text-lumen-700"
                  >
                    Voucher {{ ad.voucher.code }} · {{ ad.voucher.label }}
                  </p>
                </div>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-arrow-up"
                  :disabled="busyAdUuid === ad.uuid || index === 0 || !adsReady"
                  @click="moveAd(index, -1)"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-arrow-down"
                  :disabled="busyAdUuid === ad.uuid || index === ads.length - 1 || !adsReady"
                  @click="moveAd(index, 1)"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  :disabled="busyAdUuid === ad.uuid || !adsReady"
                  @click="startEditAd(ad)"
                >
                  Edit
                </UButton>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  :disabled="busyAdUuid === ad.uuid || !adsReady"
                  @click="toggleAdActive(ad)"
                >
                  {{ ad.isActive ? 'Hide' : 'Show' }}
                </UButton>
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  :disabled="busyAdUuid === ad.uuid || !adsReady"
                  @click="askRemoveAd(ad)"
                >
                  Delete
                </UButton>
              </div>
            </li>
          </ul>
          <p
            v-else
            class="px-5 py-8 text-sm text-stone-500"
          >
            No promotions yet. Add a promo image or attach a voucher for the carousel.
          </p>
        </section>
      </div>
    </template>

    <AdminConfirmModal
      v-model:open="deleteLinkConfirmOpen"
      title="Delete this button?"
      :description="pendingDeleteLink
        ? `Delete “${pendingDeleteLink.label}”? To keep it for later, hide it instead.`
        : 'To keep it for later, hide it instead.'"
      confirm-label="Delete"
      :loading="Boolean(busyUuid)"
      @confirm="removeLink"
    />
    <AdminConfirmModal
      v-model:open="deleteAdConfirmOpen"
      title="Delete this promotion?"
      :description="pendingDeleteAd
        ? `Delete “${pendingDeleteAd.title || 'Untitled'}”?`
        : 'This promotion will be removed.'"
      confirm-label="Delete"
      :loading="Boolean(busyAdUuid)"
      @confirm="removeAd"
    />
    <AdminConfirmModal
      v-model:open="rotateConfirmOpen"
      title="Create a new unique link?"
      description="The old QR and URL will stop working."
      confirm-label="Rotate link"
      confirm-color="warning"
      :loading="rotating"
      @confirm="rotatePageLink"
    />
    <AdminConfirmModal
      v-model:open="removeAdImageConfirmOpen"
      title="Remove this promo image?"
      description="The promotion image will be deleted."
      confirm-label="Remove"
      :loading="Boolean(busyAdUuid)"
      @confirm="removeAdImage"
    />
  </div>
</template>

<style>
@media print {
  body * {
    visibility: hidden !important;
  }
  .social-qr-card,
  .social-qr-card * {
    visibility: visible !important;
  }
  .social-qr-card {
    position: absolute;
    left: 50%;
    top: 20%;
    transform: translateX(-50%);
    width: 320px;
  }
}
</style>
