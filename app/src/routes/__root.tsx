import type { ReactNode } from 'react'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'

import { getLocale } from '~/lib/locale'
import type { Locale } from '~/lib/i18n'
import 'katex/dist/katex.min.css'
import 'mathlive/fonts.css'
import '~/styles/app.css'

export const Route = createRootRoute({
  loader: async () => ({ locale: await getLocale() }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { name: 'theme-color', content: '#FFFFFF' },
      // Static head (locale-unaware); the site now opens in English (STEMROBIN-111).
      { title: 'LemmaDeck · Secondary math & physics' },
      { name: 'description', content: 'LemmaDeck — from arithmetic to calculus, from the lever to the nucleus: one secondary course in mathematics and physics, heir to the ten-year system edited by Andrey Kolmogorov, arranged into a deck for understanding and practice, with an AI to guide you through to real mastery.' },
    ],
    links: [
      // Exact tab sizes, so the browser never rescales the wordless mark itself.
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16.png' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
      { rel: 'icon', type: 'image/png', sizes: '64x64', href: '/favicon.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
      {
        rel: 'stylesheet',
        href: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
      },
    ],
    scripts: [
      {
        src: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
        defer: true,
      },
      {
        src: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js',
        defer: true,
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  const { locale } = Route.useLoaderData()
  return (
    <RootDocument locale={locale}>
      <Outlet />
    </RootDocument>
  )
}

// `lang` was hardcoded zh-CN, which has said the wrong thing since the site
// started opening in English (STEMROBIN-111). It is what a screen reader picks a
// voice from and what a browser offers to translate from, so it follows the
// locale the shell is actually rendered in.
function RootDocument({
  children,
  locale,
}: Readonly<{ children: ReactNode; locale: Locale }>) {
  return (
    <html lang={locale === 'zh' ? 'zh-CN' : 'en'}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
