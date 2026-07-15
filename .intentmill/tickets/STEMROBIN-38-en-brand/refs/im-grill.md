# IntentMill Grill

> Self-adjudicated under n-prodfarm cap13 (full delegation, no human). Each
> `final_decision` is resolved by the delegate from charter + intent + code
> evidence, not left TBD. Grounding: `.prodfarm/charter/engineering-rules.md`
> (Simplicity First, Surgical Changes), `resources/reference/DESIGN.md`, and the
> seed grill decision G-6 recorded in `intent.md`.

## Blocking Decisions

1.
- id: D1-slogan-en-treatment
- question: In English, should the slogan be fully hidden, or shrunk / truncated / conditionally shown only when it fits one line?
- recommendation: Fully hide the slogan (`.sr-tagline`) in en. English is the only long slogan; suppression of a non-essential decorative tagline is the standard peer treatment (an ellipsized slogan reads as broken), and it needs zero measurement code — the simplest solution that satisfies acceptance. zh slogan unchanged.
- final_decision: Fully hide `.sr-tagline` when `locale === 'en'`; keep it for zh. (Adjudicated: matches intent "过长即隐藏", DESIGN.md non-decoration tone, and engineering-rules Simplicity First.)

2.
- id: D2-en-wordmark-text-and-style
- question: What exact text and styling should the en wordmark use — `stemrobin` plain, or with a colored-letter accent mirroring the zh green `更`?
- recommendation: Render plain lowercase `stemrobin` in the existing `.sr-brand-name` (Bricolage display font). The green `更` accent (`.sr-brand-name b` → `--sr-green-deep`) is a CJK-specific two-glyph treatment with no natural English split; a plain wordmark honors DESIGN.md "no decorative … beyond the single brand mark" and stays surgical.
- final_decision: en wordmark = plain lowercase `stemrobin` in `.sr-brand-name`, no colored-letter accent; zh keeps `知<b>更</b>` with the green accent. (Adjudicated from intent text "stemrobin" + DESIGN.md line 5/77–78.)

## Recommended Defaults

- Keep the logo image (`.sr-brand-img`) in both locales; only the wordmark text and slogan visibility change (per intent "Keep the logo image; only the wordmark text changes").
- Make the logo `alt` locale-aware (`en` → `stemrobin`, `zh` → `知更`) so the accessible name matches the visible wordmark — a small a11y-consistency touch on the surface the change already owns; follows from ordinary practice, no product choice.
- Implement the wordmark/slogan branch inline in `app/src/components/catalog.tsx` (where the wordmark already lives as hardcoded JSX) rather than promoting the wordmark into the `STRINGS` table in `i18n.ts` — code is authoritative and this is the more surgical path (engineering-rules Surgical Changes).
- Leave the now-unused en `brand.tagline` string in `app/src/lib/i18n.ts` untouched (dead-but-harmless), keeping the `t()` fallback map symmetric and the diff minimal. Removing it is not required and would touch the string contract unnecessarily.
- No `app.css` change expected: `.sr-brand-name` already fits `stemrobin` on one line in the 236px rail and `.sr-tagline` is simply not emitted in en; add CSS only if browser verification shows overflow (it will not at ~9 chars).

## Future Or Conditional Decisions

- If future locales (target 7–8 languages per charter goal) introduce another long slogan, the same "hide when it would wrap" rule generalizes; a per-locale slogan-visibility flag or a fits-one-line measurement could be introduced then. Out of scope now — only zh + en exist and only en's slogan is long.
- If a future ticket wants an English slogan shown, it can add a short one-line en slogan and re-enable rendering; this ticket deliberately suppresses rather than rewrites the copy.

## Out-of-Scope Guardrails

- Do not change the zh brand wordmark, zh slogan text, or any zh presentation — zh render must be byte-for-byte unchanged.
- Do not change `LanguageSwitch`, the curriculum outline, or any other localized string in `i18n.ts` beyond the brand/slogan surface.
- No new dependency, hue, font, or `--sr-*` token; no DB/schema/server change; no change to the logo image asset.
