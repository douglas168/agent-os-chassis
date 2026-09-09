# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/skills/package.json packages/skills/package.json
COPY packages/channels/package.json packages/channels/package.json
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=@agentos/web
RUN mkdir -p apps/web/public

FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
