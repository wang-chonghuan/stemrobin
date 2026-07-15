# IntentMill Spec

## Intent

Fix the catalog-header branding for English learners: when the app locale is
English the brand wordmark must read `stemrobin` (not the Chinese `知更`), and
the English slogan must never appear as ugly multi-line wrapped text. Chinese
presentation stays exactly as it is today.

## Scope

- The persistent catalog header (`.sr-cat-head`) in `app/src/components/catalog.tsx`.
- Make the wordmark (`.sr-brand-name`) locale-aware: zh → `知更` (with its existing
  green `更` accent), en → plain lowercase `stemrobin`.
- Hide the slogan (`.sr-tagline`) when locale is en; keep it for zh.
- Make the logo image `alt` locale-aware (en → `stemrobin`, zh → `知更`) so the
  accessible name matches the visible wordmark.

## Non-Scope

- Any change to Chinese presentation (zh wordmark, zh slogan text, zh accent) —
  must be byte-for-byte unchanged.
- Rewriting or shortening the English slogan copy (rejected: en slogan is
  suppressed, not reworded).
- Shrinking / truncating / ellipsizing the slogan or adding fits-one-line
  measurement (rejected in favor of full en suppression).
- Adding a colored-letter accent to the en `stemrobin` wordmark (rejected: plain).
- Promoting the wordmark into the `i18n.ts` `STRINGS` table, or removing the
  now-unused en `brand.tagline` string.
- `LanguageSwitch`, curriculum outline, any other `i18n.ts` string, the logo
  image asset, DB/schema/server, dependencies, hues, fonts, or `--sr-*` tokens.

## Requirements

- R1: When `locale === 'en'`, `.sr-brand-name` renders the text `stemrobin`
  (lowercase, plain, no `<b>` accent).
- R2: When `locale === 'zh'`, `.sr-brand-name` renders `知更` with the existing
  `<b>更</b>` green accent — identical to current output.
- R3: When `locale === 'en'`, the slogan element (`.sr-tagline`) is not rendered.
- R4: When `locale === 'zh'`, the slogan renders `t('zh', 'brand.tagline')`
  (`随时随地学理工`) exactly as today.
- R5: The logo image (`.sr-brand-img`) renders in both locales; only its `alt`
  text is locale-aware (en → `stemrobin`, zh → `知更`).
- R6: The wordmark uses the existing `.sr-brand-name` styling (`--sr-display`
  Bricolage font); no new CSS hue/token/font is introduced. `app.css` is changed
  only if browser verification shows `stemrobin` overflowing the rail.

## Critical Existing Contracts

- Locale switching contract: picking a locale in `LanguageSwitch` calls
  `setLocale` then `router.invalidate()`, re-running loaders and re-rendering the
  whole shell with the new `locale` prop. The brand/slogan must derive purely
  from the `locale` prop already passed to `CatalogSidebar`; do not add local
  state, effects, or a second locale source.
- `i18n.ts` scope contract: `t()` localizes the app's hardcoded shell strings
  with zh-fallback (`STRINGS[locale]?.[key] ?? STRINGS.zh[key] ?? key`). The zh
  `brand.tagline` path must keep resolving unchanged. The wordmark stays authored
  as component JSX (it is not in the string table today); keep it there.
- The `Locale` type (`'zh' | 'en'`) and existing `.sr-*` class names / `--sr-*`
  tokens are reused unchanged.

## Confirmed Decisions

- D1 (grill D1-slogan-en-treatment): fully hide `.sr-tagline` when
  `locale === 'en'`; keep for zh. Simplest solution satisfying acceptance; no
  measurement code.
- D2 (grill D2-en-wordmark-text-and-style): en wordmark = plain lowercase
  `stemrobin` in `.sr-brand-name`, no colored-letter accent; zh keeps
  `知<b>更</b>`.
- Recommended defaults adopted as requirements: keep logo image in both locales
  (R5); locale-aware `alt` (R5); implement the branch inline in `catalog.tsx`
  (not the string table); leave the unused en `brand.tagline` string in place;
  no `app.css` change unless overflow is observed (R6).

## Compatibility And Regression Constraints

- zh render of the catalog header (wordmark, accent, slogan text, logo) must be
  unchanged.
- No other consumer renders `.sr-brand-name`, `.sr-tagline`, or the
  `brand.tagline` key (verified by grep of `app/src/`); the change is local to
  `catalog.tsx`. Leaving the en `brand.tagline` string in `i18n.ts` keeps the
  `t()` fallback map and any future consumer unaffected.
- No change to the locale cookie, `setLocale`, router invalidation, or loader
  behavior.

## Open Questions

None.
