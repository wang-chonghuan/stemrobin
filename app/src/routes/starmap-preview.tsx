// DEV PREVIEW ONLY (safe to delete): the light "Seneca-style" starmap variant
// staged inside a white hero mock, with the current dark variant below for
// side-by-side judgement. Used to evaluate the planned UI re-skin direction.

import { createFileRoute } from '@tanstack/react-router'

import { KnowledgeGalaxy } from '~/components/knowledge-galaxy'
import { LandingStarmap } from '~/components/landing-starmap'
import { getLocale } from '~/lib/locale'

export const Route = createFileRoute('/starmap-preview')({
  component: Preview,
  loader: async () => ({ locale: await getLocale() }),
})

function Preview() {
  const { locale } = Route.useLoaderData()
  return (
    <div className="sp-page">
      <section className="sp-hero">
        <div className="sp-copy">
          <h1>
            Learn <em>2x faster</em> — one connected universe of math & physics.
          </h1>
          <p>
            A rigorous STEM curriculum transformed into structured learning decks with
            AI-guided repetition for true mastery.
          </p>
          <button type="button" className="sp-cta">
            Get started for free
          </button>
        </div>
        <div className="sp-map" aria-hidden>
          <LandingStarmap locale={locale} variant="light" />
        </div>
      </section>

      <section className="sp-universe">
        <h2>Explore the concept universe — light theme</h2>
        <p>The full draggable galaxy on a Seneca-style white ground.</p>
        <KnowledgeGalaxy locale={locale} controls theme="light" />
      </section>

      <section className="sp-dark-ref">
        <span className="sp-ref-label">current dark variant (reference)</span>
        <div className="sp-map" aria-hidden>
          <LandingStarmap locale={locale} variant="dark" />
        </div>
      </section>
    </div>
  )
}
