# Root Dockerfile — build context is the repo root (n-easyapp builds root context
# with a root Dockerfile). The app lives in the `app/` workspace; this builds it.
FROM node:24-alpine AS deps

WORKDIR /repo
# workspace manifests: root (workspaces field) + the app package + the single lockfile
COPY package.json package-lock.json ./
COPY app/package.json ./app/package.json
RUN npm ci

FROM deps AS build

COPY . .
RUN npm run build --workspace app

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# tanstack-start build output for the app workspace
COPY --from=build /repo/app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
