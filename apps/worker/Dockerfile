# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/skills/package.json packages/skills/package.json
COPY packages/channels/package.json packages/channels/package.json
RUN npm ci
COPY . .
USER node
CMD ["./node_modules/.bin/tsx", "apps/worker/src/index.ts"]
