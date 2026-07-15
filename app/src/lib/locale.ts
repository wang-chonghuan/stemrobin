import { createServerFn } from '@tanstack/react-start'

import { DEFAULT_LOCALE, isLocale, type Locale } from '~/lib/i18n'
import { currentLocale, setLocaleCookie } from '~/lib/locale.server'

// GET the learner's active locale (from the sr_locale cookie). Loaders call this
// so SSR + client render in the same language on first paint (no flash).
export const getLocale = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Locale> => currentLocale(),
)

// POST set the active locale. The switch UI calls this, then invalidates the
// router so every loader re-runs and the whole shell re-renders in the new locale.
export const setLocale = createServerFn({ method: 'POST' })
  .validator((locale: Locale) => (isLocale(locale) ? locale : DEFAULT_LOCALE))
  .handler(async ({ data }): Promise<{ locale: Locale }> => {
    setLocaleCookie(data)
    return { locale: data }
  })
