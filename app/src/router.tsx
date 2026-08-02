import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultNotFoundComponent: () => <div className="sr-notfound">页面不存在</div>,
  })

  router.subscribe('onRendered', ({ toLocation }) => {
    if (toLocation.hash || typeof document === 'undefined') return

    queueMicrotask(() => {
      document
        .querySelectorAll<HTMLElement>('[data-scroll-restoration-id]')
        .forEach((element) => element.scrollTo({ top: 0, left: 0 }))
    })
  })

  return router
}
