import type { MaintenanceChatAction } from '~/types/maintenance'
import { chatKeywords } from './chat-text'
import { APP_NAME, BUSINESS_ADDRESS } from './constants'
import {
  ABOUT_INTRO,
  ABOUT_JOURNEY,
  ABOUT_MISSION,
  ABOUT_TAGLINE,
  ABOUT_VALUES,
  ABOUT_WHO_WE_ARE,
  HOW_IT_WORKS_INTRO,
  HOW_IT_WORKS_STEPS,
} from './site-content'

export interface SiteSection {
  source: string
  path: string
  heading: string
  text: string
}

export const POLICY_DOCUMENTS = [
  {
    file: 'terms-jry-v1.txt',
    source: 'Terms & Conditions',
    path: '/terms',
    label: 'Read the Terms & Conditions',
    pattern: /\b(terms?|conditions|t ?& ?c|tos)\b/i,
    summary: 'Our Terms & Conditions cover accounts, bookings, prices and payment, the security deposit, handover and return, caring for the equipment, damage and loss, drone, Starlink, and camera rules, late returns, extensions, cancellations, and disputes.',
  },
  {
    file: 'privacy-jry-v1.txt',
    source: 'Privacy Policy',
    path: '/privacy',
    label: 'Read the Privacy Policy',
    pattern: /\b(privacy|personal (data|information|info)|data privacy|my (data|information|info|details))\b/i,
    summary: 'Our Privacy Policy explains what personal information we collect, such as your contact details, government ID, and selfie for verification, why we use it, how we protect and keep it, who we share it with, and your rights under the Data Privacy Act of 2012.',
  },
  {
    file: 'cookies-jry-v1.txt',
    source: 'Cookie Policy',
    path: '/cookies',
    label: 'Read the Cookie Policy',
    pattern: /\bcookies?\b/i,
    summary: 'Our Cookie Policy explains that we only use the cookies and browser storage needed to keep you signed in and complete bookings. We do not use advertising, marketing, or third-party analytics cookies.',
  },
] as const

const MIN_SECTION_SCORE = 2
export const SITE_STRONG_SCORE = 5

interface RankedSection {
  section: SiteSection
  score: number
  hits: number
}

function isPolicyQuestion(question: string, ranked: RankedSection[]) {
  const top = ranked[0]
  return POLICY_DOCUMENTS.some(doc => doc.pattern.test(question))
    || Boolean(top && top.score >= SITE_STRONG_SCORE && top.hits >= 2)
}

const DOC_WORDS = new Set(chatKeywords('terms conditions privacy policy cookie cookies policies tos what is are your the show me tell read explain summary summarize'))

function namedDocumentOnly(question: string) {
  const doc = POLICY_DOCUMENTS.find(item => item.pattern.test(question))
  if (!doc) {
    return null
  }
  return chatKeywords(question).every(word => DOC_WORDS.has(word)) ? doc : null
}

const HOW_IT_WORKS_RE = /\bhow (does|do) (it|this|renting|the rental|jry)( rentals?)? work\b|\bhow it works\b|\bprocess\b/i
const ABOUT_RE = /\b(about (you|jry|the (shop|company|business))|who are you|what is jry|your (mission|values|story|company|business))\b/i

function isHeading(line: string) {
  return /^\d{1,2}\.\s+\S/.test(line) && /[A-Z]/.test(line) && line === line.toUpperCase()
}

export function splitPolicySections(body: string, source: string, path: string): SiteSection[] {
  const sections: SiteSection[] = []
  let heading = 'Introduction'
  let lines: string[] = []

  const flush = () => {
    const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    if (text) {
      sections.push({ source, path, heading, text })
    }
  }

  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (isHeading(line)) {
      flush()
      heading = line.replace(/^\d{1,2}\.\s+/, '').toLowerCase().replace(/(^|\s)\w/g, letter => letter.toUpperCase())
      lines = []
      continue
    }
    lines.push(raw)
  }
  flush()
  return sections
}

export function siteOverviewFacts(options: { policies?: boolean } = {}) {
  return [
    `How it works: ${HOW_IT_WORKS_STEPS.map((step, index) => `${index + 1}. ${step.title} — ${step.copy}`).join(' ')}`,
    `About: ${ABOUT_TAGLINE} ${APP_NAME} ${ABOUT_INTRO} Based in ${BUSINESS_ADDRESS}. Journey: ${ABOUT_JOURNEY.map(step => step.title).join(', ')}. Values: ${ABOUT_VALUES.map(value => value.title).join(', ')}. Mission: ${ABOUT_MISSION.statement}`,
    ...(options.policies ? POLICY_DOCUMENTS.map(doc => doc.summary) : []),
    'Pages: How it Works, About, FAQs, Terms & Conditions, Privacy Policy, Cookie Policy.',
  ].join('\n')
}

export function chatPolicyExcerpts(question: string, ranked: RankedSection[]) {
  return isPolicyQuestion(question, ranked)
    ? ranked
    : ranked.filter(item => item.score >= 3.5 && item.hits >= 2).slice(0, 1)
}

export function mentionsPolicy(question: string, ranked: RankedSection[]) {
  return isPolicyQuestion(question, ranked)
}

export function rankSiteSections(question: string, sections: SiteSection[], options: { limit?: number, productNames?: string[] } = {}) {
  const limit = options.limit ?? 3
  const productWords = new Set((options.productNames ?? []).flatMap(name => chatKeywords(name)))
  const asked = [...new Set(chatKeywords(question))]
  const named: string[] = POLICY_DOCUMENTS.filter(doc => doc.pattern.test(question)).map(doc => doc.source)
  if (!sections.length || (!asked.length && !named.length)) {
    return []
  }

  const indexed = sections.map(section => ({
    section,
    heading: new Set(chatKeywords(section.heading)),
    body: new Set(chatKeywords(section.text)),
  }))
  const frequency = new Map<string, number>()
  for (const item of indexed) {
    for (const word of new Set([...item.heading, ...item.body])) {
      frequency.set(word, (frequency.get(word) ?? 0) + 1)
    }
  }
  const weight = (word: string) => Math.log((sections.length + 1) / ((frequency.get(word) ?? 0) + 0.5))

  const scored = indexed.map(({ section, heading, body }) => {
    let score = named.includes(section.source) ? 1.5 : 0
    let hits = 0
    for (const word of asked) {
      const counts = productWords.has(word) ? 0 : 1
      if (heading.has(word)) {
        score += weight(word) * 2
        hits += counts
      }
      else if (body.has(word)) {
        score += weight(word)
        hits += counts
      }
    }
    return { section, score, hits }
  })
    .filter(item => item.score >= MIN_SECTION_SCORE)
    .sort((left, right) => right.score - left.score)

  return scored.slice(0, limit)
}

const SENTENCE_MAX_CHARS = 260

function sentencesOf(text: string) {
  const items: Array<{ text: string, bullet: boolean }> = []
  for (const raw of text.split('\n')) {
    const bullet = /^\s*[-•]\s+/.test(raw)
    const line = raw.replace(/^\s*[-•]\s+/, '').trim()
    if (!line || (/^[A-Z]\.\s/.test(line) && line.length < 60)) {
      continue
    }
    for (const part of bullet ? [line] : line.split(/(?<=[.!?])\s+(?=[A-Z])/)) {
      items.push({ text: part.trim(), bullet })
    }
  }
  return items
}

function clipSentence(value: string, limit = SENTENCE_MAX_CHARS) {
  return value.length <= limit ? value : `${value.slice(0, value.lastIndexOf(' ', limit)).replace(/[,;:]$/, '')} …`
}

export function highlightText(question: string, text: string, max = 2, limit = SENTENCE_MAX_CHARS) {
  const asked = new Set(chatKeywords(question))
  const sentences = sentencesOf(text)
  if (!sentences.length) {
    return ''
  }

  const scored = sentences.map((sentence, index) => ({
    index,
    score: new Set(chatKeywords(sentence.text).filter(word => asked.has(word))).size,
  }))
  const chosen = scored
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, max)
    .map(item => item.index)
  const indexes = chosen.length ? chosen.sort((left, right) => left - right) : [0]

  return indexes.map((index) => {
    const sentence = sentences[index]!
    if (!sentence.text.endsWith(':')) {
      return clipSentence(sentence.text, limit)
    }
    const bullets: string[] = []
    for (let next = index + 1; next < sentences.length && sentences[next]!.bullet && bullets.length < 4; next += 1) {
      bullets.push(sentences[next]!.text)
    }
    return clipSentence(`${sentence.text} ${bullets.join('; ')}.`, limit)
  }).join(' ')
}

export function siteSectionFacts(question: string, ranked: RankedSection[]) {
  return ranked
    .map(({ section }) => `From the ${section.source}, section "${section.heading}": ${highlightText(question, section.text, 2, 420)}`)
    .join('\n')
}

export function answerFromSiteKnowledge(question: string, ranked: RankedSection[]) {
  const docOnly = namedDocumentOnly(question)
  if (docOnly) {
    return docOnly.summary
  }
  if (HOW_IT_WORKS_RE.test(question)) {
    return `${HOW_IT_WORKS_INTRO} ${HOW_IT_WORKS_STEPS.map((step, index) => `${index + 1}. ${step.title}: ${step.copy}`).join(' ')}`
  }
  if (ABOUT_RE.test(question)) {
    return `${APP_NAME} ${ABOUT_INTRO} We're based in ${BUSINESS_ADDRESS}. ${ABOUT_WHO_WE_ARE.body} Our mission: ${ABOUT_MISSION.statement}`
  }
  const top = ranked[0]
  if (!top || !isPolicyQuestion(question, ranked)) {
    return null
  }
  return `From our ${top.section.source}: ${highlightText(question, top.section.text, 2)}`
}

export function siteKnowledgeActions(question: string, ranked: RankedSection[]): MaintenanceChatAction[] {
  if (HOW_IT_WORKS_RE.test(question)) {
    return [{ kind: 'view', label: 'See how it works', to: '/#how-it-works' }]
  }
  if (ABOUT_RE.test(question)) {
    return [{ kind: 'view', label: `About ${APP_NAME}`, to: '/about' }]
  }
  if (!isPolicyQuestion(question, ranked)) {
    return []
  }
  const named = POLICY_DOCUMENTS.filter(doc => doc.pattern.test(question)).map(doc => doc.source)
  const sources = new Set<string>(named.length ? named : ranked.slice(0, 1).map(item => item.section.source))
  return POLICY_DOCUMENTS
    .filter(doc => sources.has(doc.source))
    .slice(0, 2)
    .map(doc => ({ kind: 'view' as const, label: doc.label, to: doc.path }))
}
