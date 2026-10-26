import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { HOW_IT_WORKS_STEPS } from '../../utils/site-content'
import {
  POLICY_DOCUMENTS,
  answerFromSiteKnowledge,
  chatPolicyExcerpts,
  highlightText,
  rankSiteSections,
  siteKnowledgeActions,
  siteOverviewFacts,
  siteSectionFacts,
  splitPolicySections,
} from '../../utils/site-knowledge'

const sections = POLICY_DOCUMENTS.flatMap(doc => splitPolicySections(readFileSync(`supabase/${doc.file}`, 'utf8'), doc.source, doc.path))
const productNames = ['Starlink Mini', 'DJI Air 3', 'DJI OSMO 360']

function top(question: string) {
  return rankSiteSections(question, sections, { productNames })
}

describe('chat knowledge of site pages and policies', () => {
  it('splits every policy into titled sections', () => {
    const headings = sections.map(section => `${section.source}: ${section.heading}`)
    expect(headings).toContain('Terms & Conditions: Drone Rentals')
    expect(headings).toContain('Terms & Conditions: Renter\'s Responsibilities')
    expect(headings).toContain('Privacy Policy: Data Retention')
    expect(headings).toContain('Cookie Policy: Cookies And Storage We Use')
  })

  it('finds the policy section that answers the question', () => {
    expect(top('can i fly the drone anywhere?')[0]?.section.heading).toBe('Drone Rentals')
    expect(top('what if I lose the equipment')[0]?.section.heading).toBe('Damage, Loss, And Theft')
    expect(top('what cookies do you use?')[0]?.section.source).toBe('Cookie Policy')
    expect(top('how do i delete my data')[0]?.section.heading).toBe('Data Retention')
    expect(top('what law governs the agreement')[0]?.section.heading).toBe('Governing Law')
  })

  it('keeps excerpts short enough for the free AI', () => {
    expect(siteSectionFacts('what if I lose the equipment', top('what if I lose the equipment')).length).toBeLessThanOrEqual(2600)
  })

  it('highlights only the lines that answer the question', () => {
    const cookies = sections.find(section => section.heading === 'Cookies And Storage We Use')!
    const highlight = highlightText('what cookies do you use?', cookies.text)
    expect(highlight).toContain('only as needed to operate the website and keep you signed in')
    expect(highlight.length).toBeLessThan(400)
    expect(highlight).not.toContain('color-mode')

    const drone = answerFromSiteKnowledge('can i fly the drone anywhere?', top('can i fly the drone anywhere?'))!
    expect(drone.length).toBeLessThan(420)
    expect(drone).toMatch(/location|fly/i)
  })

  it('answers How it Works, About, and named policies without the AI', () => {
    expect(answerFromSiteKnowledge('how does it work?', [])).toContain(HOW_IT_WORKS_STEPS[0]!.title)
    expect(answerFromSiteKnowledge('tell me about jry rentals', [])).toContain('Davao City')
    expect(answerFromSiteKnowledge('what is your privacy policy?', top('what is your privacy policy?'))).toContain('Data Privacy Act')
    expect(answerFromSiteKnowledge('can i fly the drone anywhere?', top('can i fly the drone anywhere?'))).toMatch(/^From our Terms & Conditions: /)
  })

  it('links to the page only for policy, How it Works, or About questions', () => {
    expect(siteKnowledgeActions('what cookies do you use?', top('what cookies do you use?'))).toEqual([
      { kind: 'view', label: 'Read the Cookie Policy', to: '/cookies' },
    ])
    expect(siteKnowledgeActions('how does it work?', [])[0]?.to).toBe('/#how-it-works')
    expect(top('how long do you keep my data?')[0]?.section.heading).toBe('Data Retention')
    expect(siteKnowledgeActions('how long do you keep my data?', top('how long do you keep my data?'))).toEqual([
      { kind: 'view', label: 'Read the Privacy Policy', to: '/privacy' },
    ])
    expect(siteKnowledgeActions('Tell me about the Starlink Mini', top('Tell me about the Starlink Mini'))).toEqual([])
    expect(siteKnowledgeActions('How do I book?', top('How do I book?'))).toEqual([])
  })

  it('always teaches the chat How it Works and About, and adds policy summaries when asked', () => {
    const facts = siteOverviewFacts()
    expect(facts).toContain('How it works:')
    expect(facts).toContain('Mission:')
    expect(facts).not.toContain('Cookie Policy explains')
    expect(facts.length).toBeLessThan(800)
    expect(siteOverviewFacts({ policies: true })).toContain('Cookie Policy explains')
  })

  it('sends policy excerpts only when the question is about a policy', () => {
    expect(chatPolicyExcerpts('can i fly the drone anywhere?', top('can i fly the drone anywhere?'))[0]?.section.heading).toBe('Drone Rentals')
    expect(chatPolicyExcerpts('Tell me about the Starlink Mini', top('Tell me about the Starlink Mini')).length).toBeLessThanOrEqual(1)
    expect(chatPolicyExcerpts('How do I book?', top('How do I book?'))).toEqual([])
  })
})
