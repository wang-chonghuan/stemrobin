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
      { name: 'description', content: 'LemmaDeck — from arithmetic to calculus, from the lever to the nucleus: one secondary course in mathematics and physics, heir to the ten-year system edited by Andrey Kolmogorov, arranged into a deck for understanding and practice, with an AI to guide you through to real mastery.' },
    ],
    links: [
      // Exact tab sizes, so the browser never rescales the wordless mark itself.
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16.png' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
      { rel: 'icon', type: 'image/png', sizes: '64x64', href: '/favicon.png' },
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
