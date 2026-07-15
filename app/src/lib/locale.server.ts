import { getCookie, setCookie } from '@tanstack/react-start/server'

import { DEFAULT_LOCALE, isLocale, type Locale } from '~/lib/i18n'

// Server-only locale primitives. The active learning locale is a plain preference
// cookie `sr_locale`. It is resolved SERVER-SIDE so overlay projection (and thus
// any answer-key exposure) never depends on a client-supplied locale value —
// mirrors the session cookie pattern in session.server.ts.
export const LOCALE_COOKIE = 'sr_locale'

// The learner's active locale (default zh). Unknown/absent cookie → the source locale.
export function currentLocale(): Locale {
  const v = getCookie(LOCALE_COOKIE)
  return isLocale(v) ? v : DEFAULT_LOCALE
}

// Persist the chosen locale. Not httpOnly (a UI preference, not a credential);
// long-lived so it survives reloads and revisits.
export function setLocaleCookie(locale: Locale): void {
  setCookie(LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
}
