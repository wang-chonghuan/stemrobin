# IntentMill Handoff — STEMROBIN-38 en-brand

## Summary

Made the catalog-header brand locale-aware and suppressed the broken English
slogan. When locale is English the wordmark now reads `stemrobin` (was the
Chinese `知更`) and the English slogan is not rendered (it previously wrapped onto
ugly multiple lines). Chinese presentation is unchanged (`知更` with the green `更`
accent + the zh slogan `随时随地学理工`).

## Actual Changes

- `app/src/components/catalog.tsx` (`.sr-cat-head` block, ~lines 27–46):
  - Logo `alt` is now locale-aware: `alt={locale === 'en' ? 'stemrobin' : '知更'}`.
  - `.sr-brand-name` renders `locale === 'en' ? 'stemrobin' : (<>知<b>更</b></>)` —
    plain lowercase `stemrobin` for en, unchanged `知<b>更</b>` (green accent) for zh.
  - `.sr-tagline` slogan is gated on `locale !== 'en'`, so it is not emitted in en;
    zh renders `t(locale, 'brand.tagline')` exactly as before.
- No other product files changed. `app/src/lib/i18n.ts` untouched (the unused en
  `brand.tagline` string is intentionally left in place). No `app/src/styles/app.css`
  change — `stemrobin` fits on one line (verified 22px) so the existing
  `.sr-brand-name` styling suffices.
- Test asset added: `.intentmill/tickets/STEMROBIN-38-en-brand/tests/browser-brand-check.mjs`
  (+ screenshots). `app/node_modules` was installed (fresh worktree had none).

## Spec And Plan Alignment

- **Spec obligations**: R1 (en `stemrobin`) ✓, R2 (zh `知更` unchanged) ✓, R3 (en
  slogan hidden) ✓, R4 (zh slogan present) ✓, R5 (logo both locales + locale-aware
  alt) ✓, R6 (existing styling, no new hue/token, no CSS change unless overflow —
  none needed) ✓. All verified in the browser (9/9) and by the screenshots.
- **Plan obligations**: implemented exactly as the single-file approach in
  `im-plan.md` Phase 1; browser verification Phase 2 (auth cookie minted, zh/en
  asserted, screenshots); Phase 3 vitest + build clean.
- **Critical existing contracts preserved**: brand/slogan/alt derive purely from
  the `locale` prop `CatalogSidebar` already receives — no local state, effect, or
  second locale source added. The locale-switch → `router.invalidate()` re-render
  contract is untouched (verified by switching en→zh and back in the browser). The
  `i18n.ts` `t()` fallback map and `Locale` type are unchanged.
- **Non-scope / rejected options honored**: no slogan reword; no ellipsis/shrink/
  fits-one-line measurement; no colored-letter en accent; wordmark not moved into
  the string table; en `brand.tagline` string not deleted; no change to
  `LanguageSwitch`, curriculum outline, other strings, DB/schema/server,
  dependencies, hues, fonts, or `--sr-*` tokens.
- **Test obligations**: see `tests/test-results.md ## Coverage Map` — every R1–R6
  requirement maps to a passing browser assertion; vitest 68/68; build clean.

## Deviations From Spec/Plan

None. Implementation matches `im-spec.md` and `im-plan.md`. The only in-flight
adjustment was to the ticket's own verification script (module resolution anchored
at `app/` via `createRequire`), not to product behavior. No `app.css` change was
required, exactly as the plan anticipated.

## Missed User-Review Points

None. All decisions were adjudicated in `im-grill.md` (cap13, full delegation) and
are non-blocking implementation choices consistent with intent, charter, and
DESIGN.md.

## Residual Issues / Future Improvements

- The en `brand.tagline` string in `app/src/lib/i18n.ts` is now unused-but-present.
  Left intentionally (surgical, keeps the fallback map symmetric); a future cleanup
  could remove it or replace it with a short one-line en slogan and re-enable
  rendering.
- Slogan suppression is currently `locale !== 'en'`. When more locales arrive
  (charter targets 7–8 languages), this may want to generalize to a per-locale
  slogan-visibility rule or a fits-one-line check rather than an en-specific branch.
  Out of scope for this ticket (only zh + en exist; only en's slogan is long).

## Verification Evidence

- Browser (headed Chromium, port 3000, test-learner cookie): 9/9 checks passed.
- Screenshots: `tests/screenshots/header-zh.png`, `tests/screenshots/header-en.png`.
- `cd app && npm run test` → 68/68 passed. `cd app && npm run build` → clean.

## Status

cap6 complete; gate6 satisfied. STOP at verified worktree — no commit, merge,
deploy, cap8, push, or PR performed (per executor scope). Changes are uncommitted
in the ticket worktree.
