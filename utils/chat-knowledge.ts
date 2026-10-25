import type { CatalogProduct } from '~/types/catalog'
import type { ChatBookingAction } from './chat-quote'
import { LATE_FEE_TYPE_HINTS } from './late-fee'

export interface ChatShopPolicies {
  lateFeePolicy?: string | null
  depositRules?: string | null
  cancellationRules?: string | null
}

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function specsText(product: CatalogProduct) {
  return Object.entries(product.specifications ?? {})
    .filter(([key, value]) => key && value)
    .slice(0, 8)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ')
}

export function productFacts(product: CatalogProduct) {
  const parts = [
    product.comingSoon ? 'coming soon, not open for booking yet' : 'available to book',
    product.dailyPrice !== null ? `${peso.format(product.dailyPrice)} per day` : null,
    product.depositAmount !== null && product.depositAmount > 0 ? `refundable deposit ${peso.format(product.depositAmount)}` : null,
    product.comingSoon ? null : `units in the shop: ${product.availableQuantity}`,
    product.category?.name ? `category ${product.category.name}` : null,
    product.shortDescription || null,
    specsText(product) ? `specs: ${specsText(product)}` : null,
    product.includedAccessories?.length ? `includes: ${product.includedAccessories.join(', ')}` : null,
    product.rentalRules ? `rules: ${product.rentalRules}` : null,
  ].filter(Boolean)
  return `${product.name} — ${parts.join(' · ')}`
}

export function productAnswer(product: CatalogProduct) {
  const opening = product.comingSoon
    ? `${product.name} is coming soon and can't be booked yet.`
    : product.dailyPrice !== null
      ? `${product.name} is available to book at ${peso.format(product.dailyPrice)} per day${product.depositAmount ? ` with a ${peso.format(product.depositAmount)} refundable deposit` : ''}.`
      : `${product.name} is available to book.`
  const specs = Object.entries(product.specifications ?? {})
    .filter(([key, value]) => key && value)
    .slice(0, 6)
    .map(([key, value]) => `${key.replaceAll('_', ' ')} ${value}`)
  return [
    opening,
    product.shortDescription || null,
    specs.length ? `Specs: ${specs.join(', ')}.` : null,
    product.includedAccessories?.length ? `Included: ${product.includedAccessories.join(', ')}.` : null,
    product.rentalRules ? `Rules: ${product.rentalRules}` : null,
  ].filter(Boolean).join(' ')
}

function unitsAnswer(product: CatalogProduct) {
  if (product.comingSoon) {
    return `${product.name} is coming soon and can't be booked yet.`
  }
  const units = product.availableQuantity === 1 ? '1 unit' : `${product.availableQuantity} units`
  return `We have ${units} of ${product.name}. Tell me your dates and how many you need, and I'll check how many are free.`
}

export function productActions(products: CatalogProduct[]): ChatBookingAction[] {
  return products.slice(0, 3).map(product => product.comingSoon
    ? { kind: 'view', label: `View ${product.name}`, to: `/products/${product.slug}` }
    : { kind: 'book', label: `Book ${product.name}`, to: `/rentals/new?product=${encodeURIComponent(product.slug)}` })
}

const LIST_RE = /\b(what|which) (gear|equipment|items|kits)\b|\bdo you (rent|have)\b|\bcatalog\b|\bavailable (items|equipment|gear)\b/

export function catalogActions(question: string, products: CatalogProduct[]) {
  const matches = mentionedProducts(question, products)
  if (matches.length) {
    return productActions(matches)
  }
  if (LIST_RE.test(normalize(question))) {
    return productActions(products.filter(product => !product.comingSoon))
  }
  return []
}

export function catalogFacts(products: CatalogProduct[]) {
  return products.map(productFacts).join('\n')
}

export function policyFacts(policies: ChatShopPolicies, paymentMethods: string[]) {
  return [
    `Late returns follow the rental agreement: ${LATE_FEE_TYPE_HINTS.schedule}`,
    policies.depositRules ? `Deposit: ${policies.depositRules}` : 'Deposit: paid with the rent and returned after the rental is finished.',
    policies.cancellationRules ? `Cancellation: ${policies.cancellationRules}` : 'Cancellation: the down payment is not refundable once the rental is booked.',
    paymentMethods.length ? `Payment methods: ${paymentMethods.join(', ')}.` : null,
    'How to pay: open the booking in My rentals, tap Pay, scan the QR code of a payment method shown there, then send the proof of payment on Facebook. The shop does not send QR codes separately.',
    'Booking steps: choose equipment and dates, sign the rental agreement, photograph a government ID and a selfie, submit the request, then pay on the booking Pay page.',
    'Coming soon items cannot be booked yet, so do not ask for dates for them.',
  ].filter(Boolean).join('\n')
}

function mentionedProducts(question: string, products: CatalogProduct[]) {
  const query = ` ${normalize(question)} `
  const wordCounts = new Map<string, number>()
  for (const product of products) {
    for (const word of new Set(normalize(product.name).split(' '))) {
      wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1)
    }
  }
  const scored = products.map((product) => {
    const name = normalize(product.name)
    if (query.includes(` ${name} `)) {
      return { product, score: 100 }
    }
    const distinctive = name.split(' ').filter(word => word.length > 1 && wordCounts.get(word) === 1)
    return { product, score: distinctive.filter(word => query.includes(` ${word} `)).length }
  }).filter(item => item.score > 0)
  const best = Math.max(0, ...scored.map(item => item.score))
  return scored.filter(item => item.score === best).map(item => item.product)
}

export function answerFromCatalog(
  question: string,
  products: CatalogProduct[],
  policies: ChatShopPolicies,
  paymentMethods: string[],
) {
  const query = normalize(question)
  if (!query) {
    return null
  }

  if (/\b(late|overdue)\b/.test(query)) {
    return `If equipment is returned late, the late fee follows the rental agreement: ${LATE_FEE_TYPE_HINTS.schedule}`
  }
  if (/\b(payment methods?|how (do|can) i pay|gcash|maya|bank|pay with)\b/.test(query) && paymentMethods.length) {
    return `You can pay with ${paymentMethods.join(', ')}. Open your booking in My rentals, tap Pay, and scan the QR code shown there. After you pay, send your proof of payment to our Facebook page.`
  }
  if (/\bdeposit\b/.test(query) && policies.depositRules) {
    return `Deposit: ${policies.depositRules}`
  }
  if (/\bcancel/.test(query) && policies.cancellationRules) {
    return `Cancellation: ${policies.cancellationRules}`
  }

  const matches = mentionedProducts(question, products)
  if (matches.length && /\bhow many\b|\bquantity\b|\bstocks?\b|\bunits?\b/.test(query)) {
    return matches.slice(0, 3).map(unitsAnswer).join('\n\n')
  }
  if (matches.length) {
    return matches.slice(0, 3).map(productAnswer).join('\n\n')
  }

  if (LIST_RE.test(query) && products.length) {
    const open = products.filter(product => !product.comingSoon).map(product => product.name)
    const soon = products.filter(product => product.comingSoon).map(product => product.name)
    return [
      open.length ? `Available to book: ${open.join(', ')}.` : null,
      soon.length ? `Coming soon: ${soon.join(', ')}.` : null,
    ].filter(Boolean).join(' ')
  }

  return null
}
