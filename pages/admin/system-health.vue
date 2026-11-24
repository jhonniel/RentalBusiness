<script setup lang="ts">
import type { SystemHealthResponse, SystemHealthStatus } from '~/types/system-health'
import { formatBusinessDateTime } from '~/utils/datetime'
import { formatBytes, formatUptime, healthLabel, healthTone } from '~/utils/system-health'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'System Health',
  path: '/admin/system-health',
})

const { data, error, pending, refresh } = await useFetch<SystemHealthResponse>('/api/admin/system-health')
const unavailable = computed(() => error.value?.statusCode === 503)
const refreshing = ref(false)

async function onRefresh() {
  refreshing.value = true
  try {
    await refresh()
  }
  finally {
    refreshing.value = false
  }
}

function statusBadge(status: SystemHealthStatus) {
  return healthTone(status)
}

function statusDot(status: SystemHealthStatus) {
  if (status === 'ok') {
    return 'bg-emerald-500'
  }
  if (status === 'degraded') {
    return 'bg-amber-500'
  }
  if (status === 'down') {
    return 'bg-red-500'
  }
  return 'bg-stone-400'
}

function overallShell(status: SystemHealthStatus) {
  if (status === 'ok') {
    return 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'
  }
  if (status === 'degraded') {
    return 'border-amber-200 bg-gradient-to-br from-amber-50 to-white'
  }
  if (status === 'down') {
    return 'border-red-200 bg-gradient-to-br from-red-50 to-white'
  }
  return 'border-stone-200 bg-gradient-to-br from-stone-50 to-white'
}

function overallTitle(status: SystemHealthStatus) {
  if (status === 'ok') {
    return 'All systems operational'
  }
  if (status === 'degraded') {
    return 'Attention needed'
  }
  if (status === 'down') {
    return 'Service disruption'
  }
  return 'Status unknown'
}

const secretItems = computed(() => {
  if (!data.value) {
    return []
  }
  const r = data.value.readiness
  return [
    { label: 'Supabase URL / anon', ok: r.supabaseConfigured },
    { label: 'Service role', ok: r.serviceRoleConfigured },
    { label: 'Cron secret', ok: r.cronConfigured },
    { label: 'Webhook secret', ok: r.webhookConfigured },
    { label: 'SMTP', ok: r.smtpConfigured },
  ]
})

const maxTableBytes = computed(() => {
  const tables = data.value?.database.tables || []
  return tables.reduce((max, table) => Math.max(max, table.sizeBytes), 0) || 1
})

function tableWidth(sizeBytes: number) {
  return `${Math.max(4, Math.round((sizeBytes / maxTableBytes.value) * 100))}%`
}

const checkSummary = computed(() => {
  const checks = data.value?.checks || []
  return {
    ok: checks.filter(c => c.status === 'ok').length,
    attention: checks.filter(c => c.status === 'degraded' || c.status === 'unknown').length,
    down: checks.filter(c => c.status === 'down').length,
    total: checks.length,
  }
})
</script>

<template>
  <div class="w-full space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <AdminPageHeader
        eyebrow="Operations"
        title="System Health"
        description="Live status for the app, Supabase, database, storage, email, and Vercel."
      />
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-refresh-cw"
        :loading="refreshing || pending"
        @click="onRefresh"
      >
        Refresh
      </UButton>
    </div>

    <AdminNotice
      v-if="unavailable"
      title="System Health is not connected"
      description="Add live Supabase credentials to load health checks."
    />

    <AdminNotice
      v-else-if="error"
      tone="alert"
      title="System Health could not be loaded"
      description="Try again in a moment."
    />

    <div
      v-else-if="pending && !data"
      class="space-y-4"
      role="status"
      aria-busy="true"
    >
      <USkeleton class="h-36 w-full rounded-2xl" />
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <USkeleton
          v-for="index in 4"
          :key="index"
          class="h-28 rounded-2xl"
        />
      </div>
      <USkeleton class="h-64 w-full rounded-2xl" />
    </div>

    <template v-else-if="data">
      <!-- Overall status -->
      <section
        class="rounded-2xl border p-5 sm:p-6"
        :class="overallShell(data.overall)"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex items-start gap-4">
            <span
              class="mt-1 inline-flex size-3 shrink-0 rounded-full ring-4"
              :class="[
                statusDot(data.overall),
                data.overall === 'ok' ? 'ring-emerald-100' : data.overall === 'degraded' ? 'ring-amber-100' : data.overall === 'down' ? 'ring-red-100' : 'ring-stone-100',
              ]"
              aria-hidden="true"
            />
            <div>
              <p class="text-[11px] font-medium uppercase tracking-wider text-stone-500">
                Overall status
              </p>
              <h2 class="mt-1 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
                {{ overallTitle(data.overall) }}
              </h2>
              <p class="mt-1.5 text-sm text-stone-600">
                Checked {{ formatBusinessDateTime(data.checkedAt) }}
                <span class="text-stone-400">·</span>
                Phase {{ data.app.phase }}
                <span class="text-stone-400">·</span>
                {{ data.app.timezone }}
              </p>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 lg:justify-end">
            <span
              class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-emerald-800"
            >
              <span class="size-1.5 rounded-full bg-emerald-500" />
              {{ checkSummary.ok }} healthy
            </span>
            <span
              v-if="checkSummary.attention"
              class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-amber-900"
            >
              <span class="size-1.5 rounded-full bg-amber-500" />
              {{ checkSummary.attention }} attention
            </span>
            <span
              v-if="checkSummary.down"
              class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-red-800"
            >
              <span class="size-1.5 rounded-full bg-red-500" />
              {{ checkSummary.down }} down
            </span>
          </div>
        </div>
      </section>

      <!-- Service status tiles -->
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="check in data.checks"
          :key="check.id"
          class="rounded-2xl border border-stone-200 bg-white p-4"
        >
          <div class="flex items-start justify-between gap-2">
            <p class="text-[11px] font-medium uppercase tracking-wider text-stone-500">
              {{ check.label }}
            </p>
            <span
              class="mt-1 size-2.5 shrink-0 rounded-full"
              :class="statusDot(check.status)"
              :title="healthLabel(check.status)"
            />
          </div>
          <p class="mt-2 text-lg font-semibold tracking-tight text-stone-900">
            {{ healthLabel(check.status) }}
          </p>
          <p class="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">
            {{ check.detail }}
          </p>
        </article>
      </div>

      <div class="grid gap-6 xl:grid-cols-2 xl:items-start">
        <!-- App -->
        <section class="rounded-2xl border border-stone-200 bg-white">
          <header class="flex items-center justify-between border-b border-stone-100 px-5 py-4">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-server"
                class="size-4 text-stone-400"
              />
              <h3 class="text-sm font-semibold text-stone-900">
                Application
              </h3>
            </div>
            <span
              class="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium"
              :class="statusBadge(data.app.status)"
            >{{ healthLabel(data.app.status) }}</span>
          </header>
          <dl class="divide-y divide-stone-50 px-5">
            <div class="flex items-center justify-between gap-4 py-3 text-sm">
              <dt class="text-stone-500">
                Uptime
              </dt>
              <dd class="tabular-nums font-medium text-stone-900">
                {{ formatUptime(data.app.uptimeSeconds) }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3 text-sm">
              <dt class="text-stone-500">
                Node
              </dt>
              <dd class="tabular-nums text-stone-900">
                {{ data.app.node }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3 text-sm">
              <dt class="text-stone-500">
                Memory
              </dt>
              <dd class="text-right text-stone-900">
                <span class="tabular-nums font-medium">{{ data.app.memoryUsedMb }} MB</span>
                <span class="text-stone-400"> heap</span>
                <span class="mx-1 text-stone-300">·</span>
                <span class="tabular-nums">{{ data.app.memoryRssMb }} MB</span>
                <span class="text-stone-400"> RSS</span>
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3 text-sm">
              <dt class="text-stone-500">
                Locale
              </dt>
              <dd class="text-stone-900">
                {{ data.app.timezone }} · {{ data.app.currency }}
              </dd>
            </div>
            <div class="flex items-start justify-between gap-4 py-3 text-sm">
              <dt class="shrink-0 text-stone-500">
                Site URL
              </dt>
              <dd class="break-all text-right font-mono text-xs text-stone-800">
                {{ data.app.siteUrl }}
              </dd>
            </div>
          </dl>
        </section>

        <!-- Supabase -->
        <section class="rounded-2xl border border-stone-200 bg-white">
          <header class="flex items-center justify-between border-b border-stone-100 px-5 py-4">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-database"
                class="size-4 text-stone-400"
              />
              <h3 class="text-sm font-semibold text-stone-900">
                Supabase
              </h3>
            </div>
            <span
              class="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium"
              :class="statusBadge(data.supabase.status)"
            >{{ healthLabel(data.supabase.status) }}</span>
          </header>
          <dl class="divide-y divide-stone-50 px-5">
            <div class="flex items-center justify-between gap-4 py-3 text-sm">
              <dt class="text-stone-500">
                Latency
              </dt>
              <dd class="tabular-nums font-medium text-stone-900">
                {{ data.supabase.latencyMs != null ? `${data.supabase.latencyMs} ms` : '—' }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3 text-sm">
              <dt class="text-stone-500">
                Project
              </dt>
              <dd class="font-mono text-xs text-stone-900">
                {{ data.supabase.projectRef || '—' }}
              </dd>
            </div>
            <div class="flex items-start justify-between gap-4 py-3 text-sm">
              <dt class="shrink-0 text-stone-500">
                Host
              </dt>
              <dd class="break-all text-right font-mono text-xs text-stone-800">
                {{ data.supabase.host || '—' }}
              </dd>
            </div>
            <div class="py-3 text-sm text-stone-500">
              {{ data.supabase.detail }}
            </div>
          </dl>
        </section>

        <!-- Secrets checklist -->
        <section class="rounded-2xl border border-stone-200 bg-white">
          <header class="flex items-center justify-between border-b border-stone-100 px-5 py-4">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-key-round"
                class="size-4 text-stone-400"
              />
              <h3 class="text-sm font-semibold text-stone-900">
                Secrets
              </h3>
            </div>
            <span
              class="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium"
              :class="data.readiness.ready ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-800 bg-amber-50 border-amber-200'"
            >
              {{ data.readiness.ready ? 'Ready' : 'Incomplete' }}
            </span>
          </header>
          <ul class="grid gap-2 p-4 sm:grid-cols-2">
            <li
              v-for="item in secretItems"
              :key="item.label"
              class="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm"
              :class="item.ok ? 'border-emerald-100 bg-emerald-50/50' : 'border-amber-100 bg-amber-50/60'"
            >
              <UIcon
                :name="item.ok ? 'i-lucide-check-circle-2' : 'i-lucide-alert-circle'"
                class="size-4 shrink-0"
                :class="item.ok ? 'text-emerald-600' : 'text-amber-600'"
              />
              <div class="min-w-0">
                <p class="font-medium text-stone-900">
                  {{ item.label }}
                </p>
                <p
                  class="text-xs"
                  :class="item.ok ? 'text-emerald-700' : 'text-amber-800'"
                >
                  {{ item.ok ? 'Configured' : 'Missing' }}
                </p>
              </div>
            </li>
          </ul>
        </section>

        <!-- Vercel -->
        <section class="rounded-2xl border border-stone-200 bg-white">
          <header class="flex items-center justify-between border-b border-stone-100 px-5 py-4">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-cloud"
                class="size-4 text-stone-400"
              />
              <h3 class="text-sm font-semibold text-stone-900">
                Vercel
              </h3>
            </div>
            <span class="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700">
              {{ data.vercel.present ? (data.vercel.env || 'Hosted') : 'Local' }}
            </span>
          </header>
          <dl class="divide-y divide-stone-50 px-5">
            <div class="flex items-center justify-between gap-4 py-3 text-sm">
              <dt class="text-stone-500">
                Region
              </dt>
              <dd class="text-stone-900">
                {{ data.vercel.region || '—' }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3 text-sm">
              <dt class="text-stone-500">
                Git ref
              </dt>
              <dd class="text-stone-900">
                {{ data.vercel.commitRef || '—' }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3 text-sm">
              <dt class="text-stone-500">
                Commit
              </dt>
              <dd class="font-mono text-xs text-stone-900">
                {{ data.vercel.commitSha ? data.vercel.commitSha.slice(0, 10) : '—' }}
              </dd>
            </div>
            <div class="flex items-start justify-between gap-4 py-3 text-sm">
              <dt class="shrink-0 text-stone-500">
                URL
              </dt>
              <dd class="break-all text-right font-mono text-xs text-stone-800">
                {{ data.vercel.url || '—' }}
              </dd>
            </div>
          </dl>
        </section>

        <!-- Database -->
        <section class="rounded-2xl border border-stone-200 bg-white xl:col-span-2">
          <header class="flex flex-col gap-2 border-b border-stone-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-hard-drive"
                class="size-4 text-stone-400"
              />
              <h3 class="text-sm font-semibold text-stone-900">
                Database storage
              </h3>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span
                v-if="data.database.sizeLabel"
                class="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium tabular-nums text-stone-800"
              >
                {{ data.database.sizeLabel }} total
              </span>
              <span
                class="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium"
                :class="statusBadge(data.database.status)"
              >{{ healthLabel(data.database.status) }}</span>
            </div>
          </header>

          <AdminNotice
            v-if="data.database.setupRequired"
            class="m-5"
            title="Paste the database health SQL"
            description="Run supabase/migrations/20261124160000_admin_database_health.sql in the Supabase SQL editor."
          />

          <template v-else>
            <div class="grid gap-4 border-b border-stone-100 px-5 py-4 sm:grid-cols-3">
              <div>
                <p class="text-[11px] font-medium uppercase tracking-wider text-stone-500">
                  Database
                </p>
                <p class="mt-1 font-medium text-stone-900">
                  {{ data.database.name || '—' }}
                </p>
              </div>
              <div>
                <p class="text-[11px] font-medium uppercase tracking-wider text-stone-500">
                  Total size
                </p>
                <p class="mt-1 text-xl font-semibold tabular-nums tracking-tight text-stone-900">
                  {{ data.database.sizeLabel || '—' }}
                </p>
              </div>
              <div>
                <p class="text-[11px] font-medium uppercase tracking-wider text-stone-500">
                  Largest tables
                </p>
                <p class="mt-1 text-sm text-stone-600">
                  {{ data.database.tables.length || 0 }} shown
                </p>
              </div>
            </div>

            <ul
              v-if="data.database.tables.length"
              class="divide-y divide-stone-50 px-5 py-2"
            >
              <li
                v-for="table in data.database.tables"
                :key="table.name"
                class="py-3"
              >
                <div class="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span class="min-w-0 truncate font-mono text-xs text-stone-700">{{ table.name }}</span>
                  <span class="shrink-0 tabular-nums font-medium text-stone-900">{{ table.sizeLabel }}</span>
                </div>
                <div class="h-1.5 overflow-hidden rounded-full bg-stone-100">
                  <div
                    class="h-full rounded-full bg-[#12201a]/80"
                    :style="{ width: tableWidth(table.sizeBytes) }"
                  />
                </div>
              </li>
            </ul>
            <p
              v-else
              class="px-5 py-6 text-sm text-stone-500"
            >
              {{ data.database.detail }}
            </p>
          </template>
        </section>

        <!-- File storage -->
        <section class="rounded-2xl border border-stone-200 bg-white">
          <header class="flex items-center justify-between border-b border-stone-100 px-5 py-4">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-folder-open"
                class="size-4 text-stone-400"
              />
              <h3 class="text-sm font-semibold text-stone-900">
                File storage
              </h3>
            </div>
            <span
              class="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium"
              :class="statusBadge(data.storage.status)"
            >{{ healthLabel(data.storage.status) }}</span>
          </header>
          <p class="border-b border-stone-100 px-5 py-3 text-sm text-stone-500">
            {{ data.storage.detail }}
          </p>
          <ul
            v-if="data.storage.buckets.length"
            class="divide-y divide-stone-50"
          >
            <li
              v-for="bucket in data.storage.buckets"
              :key="bucket.id"
              class="flex items-center justify-between gap-3 px-5 py-3 text-sm"
            >
              <div class="min-w-0">
                <p class="font-medium text-stone-900">
                  {{ bucket.id }}
                </p>
                <p class="text-xs text-stone-500">
                  {{ bucket.public ? 'Public bucket' : 'Private bucket' }}
                </p>
              </div>
              <span class="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs tabular-nums text-stone-700">
                {{ bucket.fileSizeLimit ? `Max ${formatBytes(bucket.fileSizeLimit)}` : 'No cap' }}
              </span>
            </li>
          </ul>
        </section>

        <!-- Email & maintenance -->
        <section class="rounded-2xl border border-stone-200 bg-white">
          <header class="flex items-center gap-2 border-b border-stone-100 px-5 py-4">
            <UIcon
              name="i-lucide-mail"
              class="size-4 text-stone-400"
            />
            <h3 class="text-sm font-semibold text-stone-900">
              Email & maintenance
            </h3>
          </header>
          <div class="grid gap-3 p-4 sm:grid-cols-2">
            <div class="rounded-xl border border-stone-100 bg-stone-50/80 p-4">
              <div class="flex items-center justify-between gap-2">
                <p class="text-[11px] font-medium uppercase tracking-wider text-stone-500">
                  SMTP
                </p>
                <span
                  class="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium"
                  :class="statusBadge(data.email.status)"
                >{{ healthLabel(data.email.status) }}</span>
              </div>
              <p class="mt-3 text-sm leading-5 text-stone-600">
                {{ data.email.detail }}
              </p>
            </div>
            <div class="rounded-xl border border-stone-100 bg-stone-50/80 p-4">
              <div class="flex items-center justify-between gap-2">
                <p class="text-[11px] font-medium uppercase tracking-wider text-stone-500">
                  Maintenance
                </p>
                <span
                  class="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium"
                  :class="statusBadge(data.maintenance.status)"
                >{{ data.maintenance.enabled ? 'On' : 'Off' }}</span>
              </div>
              <p class="mt-3 text-sm leading-5 text-stone-600">
                {{ data.maintenance.detail }}
              </p>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
