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
      { title: 'MynaTree · AI 数学老师' },
      { name: 'description', content: 'MynaTree — 孩子的私人 AI 数学老师：卡片式学习、即时反馈、讲到会为止、还能超前学。' },
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
