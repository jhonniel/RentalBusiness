// https://nuxt.com/docs/api/configuration/nuxt-config
import { supabaseModuleKey, supabaseModuleUrl } from './utils/supabase-config'

const publicSupabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL || ''
const publicSupabaseKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.NUXT_PUBLIC_SUPABASE_KEY
  || ''

export default defineNuxtConfig({

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    '@nuxtjs/supabase',
  ],

  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  app: {
    head: {
      htmlAttrs: {
        lang: 'en-PH',
      },
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      meta: [
        { name: 'theme-color', content: '#0f1c17' },
        { name: 'format-detection', content: 'telephone=no' },
        { name: 'description', content: 'Rent cameras, drones, and Starlink in Davao City. Book online with JRY Rentals.' },
        { property: 'og:site_name', content: 'JRY Rentals' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/logo.png' },
        { rel: 'apple-touch-icon', href: '/logo.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap' },
      ],
    },
    pageTransition: {
      name: 'page',
      mode: 'out-in',
    },
  },

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'light',
    fallback: 'light',
    storageKey: 'lumen-color-mode',
  },

  runtimeConfig: {
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: process.env.SMTP_PORT || '587',
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpFrom: process.env.SMTP_FROM || '',
    paymentProviderKey: process.env.PAYMENT_PROVIDER_KEY || '',
    paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || '',
    cronSecret: process.env.CRON_SECRET || process.env.NUXT_CRON_SECRET || '',
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      supabaseUrl: publicSupabaseUrl,
      supabaseAnonKey: publicSupabaseKey,
    },
  },

  routeRules: {
    '/': { swr: false },
    '/products': { swr: 30 },
    '/products/**': { swr: false },
    '/about': { swr: 3600 },
    '/privacy': { swr: 3600 },
    '/terms': { swr: 3600 },
    '/api/**': { headers: { 'cache-control': 'private, no-store' } },
    '/admin/**': { headers: { 'cache-control': 'private, no-store' } },
    '/dashboard': { headers: { 'cache-control': 'private, no-store' } },
    '/my-rentals': { headers: { 'cache-control': 'private, no-store' } },
    '/profile': { headers: { 'cache-control': 'private, no-store' } },
    '/notifications': { headers: { 'cache-control': 'private, no-store' } },
    '/rentals/**': { headers: { 'cache-control': 'private, no-store' } },
    '/receipts/**': { headers: { 'cache-control': 'private, no-store' } },
    '/payments/**': { headers: { 'cache-control': 'private, no-store' } },
    '/confirm': { headers: { 'cache-control': 'private, no-store' } },
    '/accept-policies': { headers: { 'cache-control': 'private, no-store' } },
    '/reset-password': { ssr: false },
  },

  experimental: {
    typedPages: true,
  },
  compatibilityDate: '2025-07-15',

  nitro: {
    compressPublicAssets: true,
  },

  typescript: {
    strict: true,
  },

  eslint: {
    config: {
      stylistic: true,
    },
  },

  icon: {
    clientBundle: {
      scan: true,
      sizeLimitKb: 256,
    },
  },

  supabase: {
    redirect: false,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: [],
      saveRedirectToCookie: false,
    },
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
    types: '~/types/database.types.ts',
    url: supabaseModuleUrl(publicSupabaseUrl),
    key: supabaseModuleKey(publicSupabaseKey),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY,
    secretKey: process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.NUXT_SUPABASE_SECRET_KEY
      || process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY,
  },
})
