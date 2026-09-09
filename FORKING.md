# Forking agent-os-chassis

## 1. Rename

```bash
npm install
npm run rename -- --name acme-quotes --display "Acme Quotes"
npm install
```

The second `npm install` is required — renaming changes every `package.json`
`name` field, which breaks the workspace symlinks `npm install` created
before the rename. This is not a mistake in the tool; `npm run rename` needs
`tsx` to already be installed to run at all, so it cannot install itself
before rewriting the names it depends on.

`rename.ts` rewrites exactly these things, and nothing else (no scanning,
no inference):

1. The `@agentos/` package scope — every `package.json` `name` field, every
   workspace `dependencies` entry, every `import ... from "@agentos/..."`
   specifier, and any Dockerfile/compose reference to the scope.
2. The root `package.json` `"name": "agent-os-chassis"` field.
3. Postgres user/password/database name — the literal token `agentos`,
   replaced everywhere it appears in `docker-compose.yml`, `.env.example`
   (`DATABASE_URL`/`TEST_DATABASE_URL`), `docker/init-test-db.sql` (which
   creates the `agentos_test` database those connection strings point at),
   `.github/workflows/ci.yml` (the CI Postgres service's own credentials),
   `apps/web/.env.example` (a second env template), and
   `packages/core/test/scaffold.test.ts` (a `pg_isready -U agentos`
   health-check).
4. The sidebar brand string and browser tab title (`"Agent OS"` in
   `apps/web/components/shell/sidebar.tsx` and `apps/web/app/layout.tsx`)
   and the `README.md` header — all replaced with your `--display` value.
5. The CamelCase brand token `AgentOS` (no space) — the chat AI's own
   system prompt (`packages/core/src/engine/chat-agent.ts`) and
   `packages/core/test/scaffold.test.ts`'s test descriptions — replaced
   with your `--display` value stripped of spaces (e.g. `"Acme Quotes"` →
   `"AcmeQuotes"`).

**Never touched:** `CLAUDE.md`, `HANDOFF.md` — these describe this
project's own build-workflow tooling (Claude Code skills, milestone
bookkeeping), not your product. Delete them if you don't use that tooling;
leave them if you're curious how this chassis was built.

## 2. Post-rename manual steps

```bash
cp .env.example .env.local
docker compose up -d
npm run db:migrate
npm run seed
```

Then set `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` in `.env.local` — any
OpenAI-compatible endpoint works, including a local Ollama server (the
`.env.example` default). `npm run seed` reads `.env.local` directly
(`tsx --env-file=.env.local`) — without the copy above it fails immediately,
before you ever reach the LLM config step.

## 3. Adding a skill

Copy `packages/skills/src/echo/` to a new folder under `packages/skills/src/`,
rename its `manifest.ts`'s `id` (and `name`/`description`), and implement
`understand.ts` and `draft.ts` for your domain. `index.ts` exports a single
`Skill` object combining `manifest`/`trigger`/`understand`/`draft`/`execute`
— give it a name and export it, then add it to the `SKILLS` array (and its
own `export { ... }` line) in `packages/skills/src/index.ts`. See
`packages/skills/src/ar-reminder/` for a fuller example with its own table
and a cron trigger.

## 4. Removing a demo skill

Delete its folder, remove it from the `SKILLS` array and its `export` line
in `packages/skills/src/index.ts`, and generate a drop migration for any
table it owned (`npm run db:generate --workspace=@<your-slug>/core` after
removing its schema export, where `<your-slug>` is whatever you passed to
`--name` above) — an orphan table plus a migration referencing a deleted
schema module is the first thing you hit after `npm run rename` if you skip
this.
