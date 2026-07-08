# Root Dockerfile — build context is the repo root (n-easyapp hard-codes a root
# Dockerfile + root build context). The web app is a standalone project in app/;
# this builds it. No repo-root package.json exists — the app owns its own manifest.
FROM node:24-alpine AS build
WORKDIR /app
# install from the app's own manifest + lockfile (context paths are repo-root relative)
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
# tanstack-start build output
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
