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
# Local development env links target the host's root .env.local, which is
# intentionally excluded from this build context. Remove the links before
# Next inspects the project directory; Compose supplies runtime env instead.
RUN rm -f apps/web/.env apps/web/.env.local apps/web/.env.*
# Next evaluates the auth module while collecting routes. Give that build
# process an ephemeral secret so the runtime guard remains strict without
# baking a usable or published secret into the image.
RUN BETTER_AUTH_SECRET="$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64"))')" npm run build --workspace=@agentos/web
RUN mkdir -p apps/web/public

FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
