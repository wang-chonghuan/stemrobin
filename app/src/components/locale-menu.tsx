import { useRouter } from '@tanstack/react-router'
import { Check, Languages } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { LOCALES, t, type Locale } from '~/lib/i18n'
import { setLocale } from '~/lib/locale'

// Language names are shown in their own language (self-referential), so they are
// not routed through the i18n table.
const LOCALE_NAME: Record<Locale, string> = { zh: '中文', en: 'English' }

// The learning-language switch, at the top-right of the detail pane. It sits in
// the shell rather than in each route's own top bar — five routes render one of
// those, and the control is the same on all of them.
//
// Picking a locale writes the cookie and invalidates the router, so every loader
// re-runs and the whole shell — catalog, outline, card — comes back in the new
// language. That is what keeps the first paint from flashing the wrong one.
export function LocaleMenu({ locale }: { locale: Locale }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function pick(next: Locale) {
    setOpen(false)
    if (next === locale) return
    await setLocale({ data: next })
    await router.invalidate()
  }

  return (
    <div className="sr-langmenu" ref={rootRef}>
      <button
        type="button"
        className={'sr-langmenu-btn' + (open ? ' open' : '')}
        aria-label={t(locale, 'switch.aria')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Languages size={16} aria-hidden />
        <span>{LOCALE_NAME[locale]}</span>
      </button>
      {open && (
        <div className="sr-langmenu-pop" role="menu" aria-label={t(locale, 'switch.aria')}>
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              role="menuitemradio"
              aria-checked={l === locale}
              className={'sr-usermenu-item' + (l === locale ? ' active' : '')}
              onClick={() => pick(l)}
            >
              <span>{LOCALE_NAME[l]}</span>
              {l === locale && <Check size={15} aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
