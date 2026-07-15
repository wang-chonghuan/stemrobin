# IntentMill Plan

## Source Contract

`im-spec.md` is the only requirement contract for this ticket. `im-draft.md` and
`im-grill.md` are background sources; their material constraints (D1 slogan
suppression, D2 plain en wordmark, locale-aware alt, leave-string-in-place,
no-CSS-unless-overflow) are already promoted into `im-spec.md`.

## Implementation Approach

Single-file component change plus a browser-verified render, using the `locale`
prop that `CatalogSidebar` already receives.

- `app/src/components/catalog.tsx`, inside `.sr-cat-head`:
  - Wordmark: replace the hardcoded `知<b>更</b>` inside `<span className="sr-brand-name">`
    with a `locale === 'en'` branch → `stemrobin` (plain text), else the existing
    `知<b>更</b>` fragment. Keep the same `.sr-brand-name` span so styling is
    reused (R1, R2).
  - Slogan: gate the `<span className="sr-tagline">…</span>` on
    `locale !== 'en'` so it is not emitted in en (R3, R4).
  - Logo `alt`: change the hardcoded `alt="知更"` on `.sr-brand-img` to
    `locale === 'en' ? 'stemrobin' : '知更'` (R5).
- `app/src/lib/i18n.ts`: no change. The en `brand.tagline` string stays in place,
  unused-but-harmless (spec Non-Scope / Confirmed Decisions).
- `app/src/styles/app.css`: no change expected. Only if browser verification
  shows `stemrobin` overflowing the 236px rail, add a minimal fit adjustment on
  `.sr-brand-name` using existing tokens (R6). Do not pre-emptively edit CSS.

## Implementation Drift Controls

- Derive wordmark text, slogan visibility, and alt purely from the existing
  `locale` prop. Do not introduce local state, `useEffect`, a new locale source,
  or a second render path — the locale-switch → `router.invalidate()` re-render
  contract already delivers the new `locale`.
- zh output must be byte-for-byte unchanged: the zh branch must keep the exact
  `知<b>更</b>` fragment and the exact `t(locale, 'brand.tagline')` slogan call.
  Do not "clean up" the zh markup.
- Rejected options must not reappear: no slogan rewording, no ellipsis/shrink/
  fits-one-line measurement, no colored-letter en accent, no moving the wordmark
  into the string table, no deletion of the en `brand.tagline` string.
- Do not add a dependency, hue, font, or `--sr-*` token. Do not touch DB,
  schema, server functions, `setLocale`, or the locale cookie.
- If `stemrobin` visibly overflows (unexpected), fix with a minimal existing-token
  CSS adjustment and record it in `im-handoff.md`; do not silently restyle the
  wordmark.

## Phases

1. Edit `app/src/components/catalog.tsx`: locale-aware wordmark, conditional
   slogan, locale-aware logo `alt`. Verify: TypeScript compiles; the `.sr-cat-head`
   JSX still passes `locale` through unchanged. No other consumer of
   `.sr-brand-name`/`.sr-tagline` exists (grep-confirmed in cap3), so no other
   component needs a regression check.
2. Empirical browser verification (gate6, standalone Playwright from
   `app/node_modules/playwright`): start `cd app && npm run dev`; mint the
   test-learner `sr_session` cookie (HMAC secret `process.env.SESSION_SECRET ||
   'stemrobin-dev-session-secret'`, user 2, no password typed) since the app is
   behind the auth gate; load the app.
   - Assert zh header: `.sr-brand-name` text contains `知更`; `.sr-tagline`
     present with the zh slogan.
   - Switch to EN via `LanguageSwitch`; assert `.sr-brand-name` text is
     `stemrobin`; assert `.sr-tagline` is absent (not rendered) — i.e. no broken
     multi-line slogan.
   - Confirm the en wordmark sits on a single line (no overflow) in the rail.
   - Screenshot the zh header and the en header.
3. `cd app && npm run test` (vitest floor) and `cd app && npm run build` must be
   clean. Confirm `.env` (or `app/.env` symlink) present for dev/build env.
4. Write `im-handoff.md`.

## Unit Test Plan

- Primary verification is the gate6 browser assertion in Phase 2 (the branch is
  inline JSX in a shell component that pulls in router `Link`/`useRouter` and the
  curriculum loader, so a pure unit render is high-friction and lower-fidelity
  than the real header). This is the closest faithful check per the R-TEST
  analysis.
- Regression floor: `cd app && npm run test` must stay green — the existing
  vitest suite (incl. any i18n/`t()` tests) must not regress, since the change
  does not alter `t()` or the string table.
- Ticket-scoped assertions covered by Phase 2 browser checks: R1 (en wordmark
  `stemrobin`), R2 (zh `知更` unchanged), R3 (en slogan absent), R4 (zh slogan
  present), R5 (logo present both locales). If any browser assertion cannot run
  (dev server / cookie failure), treat it as a blocker per cap6 blocked-exit, not
  a mock-around.

## Handoff Expectations

After development, write `im refs path/im-handoff.md` summarizing the actual
changes at file/line granularity (catalog.tsx wordmark + slogan + alt), whether
implementation matched `im-spec.md`/`im-plan.md`, any CSS adjustment that proved
necessary, browser evidence (zh=知更+slogan, en=stemrobin+no slogan) with
screenshot paths, `npm run test` + `npm run build` results, and any residual
issues, grill leaks, or future improvements (e.g. generalizing slogan
suppression when more locales arrive). Do not return to cap4 for new decisions.
