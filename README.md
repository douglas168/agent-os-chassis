# Agent OS

A fork-and-rename monorepo for building AI-employee SaaS products: a loop
engine (ingest → understand → draft → human approval → execute →
scheduled follow-up), Postgres/Drizzle, Better-Auth RBAC, and a 13-screen
operator UI — proven end to end by a demo accounts-receivable reminder
skill with no external accounts required.

## 30-minute quickstart

After copying `.env.example` below, set a non-empty `BETTER_AUTH_SECRET` in
`.env.local` before running `npm run seed` or starting an app — generate one
with `openssl rand -base64 32`. `npm run dev --workspace=@agentos/web`
auto-creates an `apps/web/.env.local` symlink to the root file on first run
via a `predev` hook; edit the root `.env.local` only. This lets Next.js load
the same values as the worker and Compose.

```bash
git clone <your-fork-url>
cd agent-os-chassis
npm install
cp .env.example .env.local
docker compose up -d --wait postgres
npm run db:migrate
npm run seed
npm run dev --workspace=@agentos/web
```

`docker compose up -d --wait postgres` starts only the database and waits for
its healthcheck —
`npm run dev --workspace=@agentos/web` runs the web app locally on port
3000. (There is no root-level `dev` script — only `apps/web/package.json`
defines one, so the bare form `npm run dev` fails with "Missing script:
dev".) The `web`/`worker` Docker images exist too, but they're for the
fresh-clone proof in `verify-fork.sh` and production, not local dev —
running them here as well would fight over port 3000. In a second
terminal, start the worker so the demo's cron sweep runs:

```bash
npm run dev --workspace=@agentos/worker
```

The worker sweeps the seeded overdue invoice into a pending Action within
seconds of starting — no browser step needed to trigger it. `/approvals` is
the screen that would show it, but the web app has no sign-in page yet, so
`/approvals` returns a bare 401 in a browser (`apps/web/proxy.ts` returns
that by design, until a sign-in page exists). A working browser walkthrough
of the approve step needs that page, which is not yet built.

By default `.env.example` points `LLM_BASE_URL` at a local Ollama server
(`qwen2.5:7b`). Point it at OpenAI, Anthropic, or any OpenAI-compatible
endpoint instead by setting `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` in
`.env.local` before starting the worker.

## Forking this for your own product

See [FORKING.md](FORKING.md) — the rename script, adding/removing demo
skills, and what never gets touched by the rename.

## Development

```bash
npm test          # vitest, chassis + skill-harness tests
npm run typecheck
npm run build
```

## License

MIT — see [LICENSE](LICENSE) and [NOTICE](NOTICE) for vendored-component
attribution.
