import type { ReactNode } from 'react'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'

import '~/styles/app.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      // Static head (locale-unaware); the site now opens in English (STEMROBIN-111).
      { title: 'LemmaDeck · Secondary math & physics' },
      { name: 'description', content: 'LemmaDeck — from arithmetic to calculus, from the lever to the electromagnetic field: one secondary course in mathematics and physics, heir to the ten-year system edited by the mathematician Kolmogorov, arranged into decks of understanding and practice, with AI to carry you through to real mastery.' },
    ],
    links: [
      { rel: 'icon', type: 'image/png', href: '/favicon.png' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
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
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
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
