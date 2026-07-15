# IntentMill Draft

## Source

- ticket key: STEMROBIN-38-en-brand
- ticket id: STEMROBIN-38
- `meta.json` read (batch 0006-titles-auth-cleanup, seed STEMROBIN-32, full delegation).
- `intent.md` read as the raw original user input.
- `AGENTS.md` read (thin router → `.prodfarm/charter/`).
- Charter read: `.prodfarm/charter/` is inlined in `intent.md` (goal, redlines, engineering-rules, architecture, runbook). Engineering rules 2/3 (Simplicity First, Surgical Changes) and the Tailwind/`--sr-*` token + `DESIGN.md` styling constraints are binding.
- Evodocs read: `intent.md` inlines `mod--app--learner-experience.md`. Relevant facts: the catalog is the persistent left shell; CSS owns the visual implementation via stable semantic class names; the CSS token layer is the source of truth for implemented layout/color values.
- Code areas inspected:
  - `app/src/components/catalog.tsx` — the `.sr-cat-head` block (lines 26–41): `.sr-brand-img` logo, `.sr-brand-name` wordmark (hardcoded `知<b>更</b>`), `.sr-tagline` (`t(locale, 'brand.tagline')`), and `LanguageSwitch`.
  - `app/src/lib/i18n.ts` — `brand.tagline` key: zh `随时随地学理工`, en `Learn STEM anytime, anywhere`; the `t()` helper and `Locale` type.
  - `app/src/styles/app.css` — `.sr-cat-head` (150), `.sr-brand-name` (168) + `.sr-brand-name b` green accent (177), `.sr-tagline` (181), `.sr-brand-img` (898).
- External docs: none needed. No new library/SDK/API/CLI/cloud service is used; change is pure in-repo React + CSS + a locale string.
- `nf-db`: not used. No database read/write/schema touch — brand wordmark and slogan are app-hardcoded shell strings, not DB content (per i18n.ts header: this module localizes the app's own hardcoded strings, not the `sr_lesson_i18n` overlay).
- Frontend `DESIGN.md` read: `resources/reference/DESIGN.md`. Binding facts: display font is `Bricolage Grotesque` "Used for brand, titles" (line 41); the single gradient brand mark + a lucide glyph is "the whole brand expression" (line 77–78); no new hues/decoration.

## Draft Spec

- **Intent**: When locale = en the catalog-header brand wordmark must read `stemrobin` (not `知更`), and the English slogan must not render as ugly multi-line wrapped text. When locale = zh everything stays exactly as today (`知更` wordmark + zh slogan `随时随地学理工`).
- **Scope**:
  - Make the `.sr-brand-name` wordmark text locale-aware: zh → `知更` (with the existing green `更` accent), en → `stemrobin`.
  - In en, do not show the slogan (`.sr-tagline`). zh slogan unchanged.
  - Keep the logo image (`.sr-brand-img`) in both locales.
- **Non-scope**: no change to zh presentation; no change to `LanguageSwitch`, catalog outline, or any other UI surface; no new hue/font/token; no new dependency; no DB/schema/server change; no change to the other en UI strings.
- **Compatibility**: `Locale` type, `t()` helper, and existing `--sr-*` tokens / `.sr-*` class names are reused unchanged. zh render is byte-for-byte unchanged.
- **UI requirements**: wordmark uses the existing `.sr-brand-name` styling (Bricolage display font per DESIGN.md line 41). The en wordmark is plain text `stemrobin` (no green-accent split — the `知<b>更</b>` accent is a Chinese-specific treatment with no natural English analogue; keeping en plain honors DESIGN.md "no decorative" tone). Slogan hidden in en means the header shows logo + wordmark only, which is a valid, clean state (the `.sr-cat-head` is `align-items: center`, so a single wordmark line centers fine).
- **Lifecycle**: picking a locale already re-renders the whole shell (catalog + detail) via `router.invalidate()`; the wordmark/slogan just follow `locale` like every other localized string.

## Draft Plan

- **Wordmark (catalog.tsx)**: replace the hardcoded `知<b>更</b>` inside `.sr-brand-name` with a locale branch: `locale === 'en' ? 'stemrobin' : <>知<b>更</b></>`. Keep the same `<span className="sr-brand-name">`.
- **Slogan (catalog.tsx)**: render `.sr-tagline` only when `locale !== 'en'` (i.e. `{locale !== 'en' && <span className="sr-tagline">{t(locale, 'brand.tagline')}</span>}`). This is the simplest robust "hide when it would wrap badly" — English is the only long slogan; hiding it for en removes the multi-line wrap entirely with no measurement code.
- **Logo alt (catalog.tsx)**: `.sr-brand-img` `alt` is hardcoded `知更`; make it locale-aware (`locale === 'en' ? 'stemrobin' : '知更'`) so the accessible name matches the visible wordmark. Small a11y-consistency touch on a surface the change already owns.
- **i18n.ts**: the `brand.tagline` en string may be left as-is (it is simply no longer rendered) — leaving it avoids touching the fallback contract. Draft preference: leave the en `brand.tagline` value untouched (dead-but-harmless) rather than delete it, to keep the change surgical and the `t()` fallback map symmetric. (Grill: confirm keep-vs-remove.)
- **app.css**: likely no change needed — `.sr-brand-name` already fits `stemrobin` on one line at 20px in the 236px rail; `.sr-tagline` simply isn't emitted in en. Verify in browser; only add CSS if `stemrobin` overflows (it will not at ~9 chars).
- **Tests**: a small unit test asserting the wordmark/slogan branching is awkward because the logic is inline JSX. Prefer a browser assertion (gate6): zh header shows `知更` + zh slogan; en header shows `stemrobin` and no slogan text. Optionally a tiny component render test if the branch is extracted; draft leans on browser verification as the primary gate.

## Code And Evodocs Findings

- **R-UI — touched/affected surfaces (concrete)**: the only surface is the persistent catalog header `.sr-cat-head` in `app/src/components/catalog.tsx` (lines 26–41). Elements inside it: `.sr-brand-img` (logo, `alt="知更"`), `.sr-brand-name` (wordmark, hardcoded `知<b>更</b>`), `.sr-tagline` (slogan), `LanguageSwitch`. No other component renders the brand wordmark or the `brand.tagline` key (grep of `src/` shows `sr-brand-name`/`sr-tagline`/`brand.tagline` only here). So the change is fully localized; no other screen shows a stale `知更`/English-slogan.
- **R-UI — peer/best-practice pattern**: multilingual product wordmarks follow one of two patterns — (a) a fixed brandmark that never localizes (e.g. many SaaS keep a Latin wordmark in every locale), or (b) a locale-swapped wordmark where a CJK logogram brand is replaced by its romanized/Latin brand string for Latin-script locales. This ticket is explicitly pattern (b): the product's Chinese brand `知更` maps to its established Latin brand `stemrobin` (the repo/app name) for English. For an overflowing tagline, the standard responsive treatments are: truncate (ellipsis), shrink font, or suppress the secondary line; for a short decorative slogan the cleanest is suppression rather than an ellipsized fragment (an ellipsized slogan reads as broken). Intent selects suppression ("过长即隐藏") — consistent with best practice for a non-essential tagline.
- **DESIGN.md binding tokens/rules cited**: wordmark uses `--sr-display` (Bricolage Grotesque) already applied by `.sr-brand-name` (DESIGN.md line 41 "Used for brand, titles"). Slogan uses `--sr-ink-dim` via `.sr-tagline`. No new hue/token/font is introduced; the green `更` accent (`--sr-green-deep` via `.sr-brand-name b`) stays zh-only. This complies with DESIGN.md "No mascots, no marketing layout, no decorative gradients beyond the single brand mark" (line 5) and the single-brand-expression rule (lines 77–78).
- **i18n architecture**: `app/src/lib/i18n.ts` explicitly scopes itself to the app's hardcoded shell strings + curriculum labels, NOT DB content. The brand wordmark, however, is currently NOT in the string table — it is hardcoded JSX in the component. Making it locale-aware in the component (a small inline branch) matches how the wordmark is already authored; promoting it into the `STRINGS` table is an option but would be more churn than the intent needs. Code is authoritative: the wordmark lives in the component, so branch it there.
- No evodocs/code disagreement found.

## Assumptions

- A1 (confirmed by intent): `stemrobin` is the English wordmark text (lowercase), exactly as the intent states.
- A2 (resolved, grill D1-slogan-en-treatment): hide the slogan entirely in en (full suppression), zh slogan unchanged. Simplest solution satisfying acceptance.
- A3 (resolved, grill D2-en-wordmark-text-and-style): the en wordmark is plain `stemrobin`, no green-letter accent; zh keeps `知<b>更</b>`.
- A4 (resolved, grill Recommended Defaults): leave the now-unused en `brand.tagline` string in i18n.ts untouched (surgical, symmetric fallback map).
- A5 (resolved, grill Recommended Defaults): logo `alt` becomes locale-aware (`stemrobin` / `知更`).

## Risks

- **R-TEST**: the brand/slogan branching is inline JSX in a shell component; a pure unit test would require extracting the branch or rendering the full `CatalogSidebar` (which pulls in router `Link`/`useRouter` + curriculum loader). The pragmatic, spec-faithful verification is a browser assertion of the two header states (zh: `知更` + slogan; en: `stemrobin`, no slogan). Login is required to reach the app (auth gate), so gate6 mints the test-learner `sr_session` cookie (HMAC secret from `SESSION_SECRET` env, user 2, no password typed) per the ticket rules and the `sr-test-account` memory. `cd app && npm run test` (vitest floor) + `npm run build` must stay clean; existing tests must not regress.
- **R-UI (low)**: hiding the tagline changes the header's vertical rhythm in en (single wordmark line instead of wordmark + slogan). `.sr-cat-head` is `align-items: center`, so this centers cleanly; verify in browser it does not look empty/misaligned.
- No DB, schema, prompt, state-machine, external-API, new-dependency, new-service, config/secret, or deployment risk — the change is a component-local locale branch + conditional render.

## Grill Required

completed
