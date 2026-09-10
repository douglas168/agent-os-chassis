import { readFileSync, writeFileSync, readdirSync, lstatSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const EXCLUDED_DIRS = new Set(["node_modules", ".git", ".next", "dist", ".data", ".worktrees", ".superpowers"]);
const EXCLUDED_FILES = new Set(["CLAUDE.md", "HANDOFF.md", "rename.ts", "rename.test.ts"]);
const OLD_SCOPE = "agentos";
const OLD_DB_TOKEN = "agentos";
const OLD_DISPLAY = "Agent OS";
const OLD_DISPLAY_CAMEL = "AgentOS";

export function rewriteScope(content: string, oldSlug: string, newSlug: string): string {
  return content.split(`@${oldSlug}/`).join(`@${newSlug}/`);
}

export function rewriteToken(content: string, oldToken: string, newToken: string): string {
  return content.split(oldToken).join(newToken);
}

// npm package-scope rules, Postgres identifier rules, and Docker Compose
// project-name rules all agree on this shape — one check covers every
// consumer of `slug` (adversarial-plan-review F8: an unvalidated slug with
// spaces, uppercase, or a leading digit gets inserted raw into JSON,
// Postgres identifiers, and connection-string URLs, corrupting the fork).
export function validateSlug(slug: string): void {
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    throw new Error(
      `Invalid --name "${slug}" — must be lowercase letters, digits, and hyphens, starting with a letter.`
    );
  }
}

export function validateDisplay(display: string): void {
  if (!display.trim()) {
    throw new Error("--display must not be empty");
  }
  if (/["'`\\]/.test(display)) {
    throw new Error(
      `Invalid --display "${display}" — must not contain quote or backslash characters (would break generated source files).`
    );
  }
}

export function walkRepoFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      const rel = relative(root, full);
      if (EXCLUDED_FILES.has(entry)) continue;
      // Do not follow the checked-in web env symlinks. They intentionally
      // point at a forker's root .env.local, which is absent until the
      // quickstart copy step and is therefore a dangling link in a fresh
      // clone.
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx|json|yml|yaml|md)$/.test(entry) || entry === "Dockerfile") {
        out.push(rel);
      }
    }
  }
  walk(root);
  return out;
}

function rewriteFile(root: string, relPath: string, transform: (content: string) => string) {
  const full = join(root, relPath);
  // Fixed-list rewrites name files this task's own build order hasn't
  // created yet (README.md is Task 7) and files a real fork may have
  // deleted (HANDOFF.md, per FORKING.md's own advice) — skip rather than
  // crash (adversarial-plan-review F7). The repo-wide walk never hits this
  // path: walkRepoFiles only returns files it already confirmed exist.
  if (!existsSync(full)) return;
  const before = readFileSync(full, "utf-8");
  const after = transform(before);
  if (after !== before) writeFileSync(full, after, "utf-8");
}

export function runRename(root: string, opts: { slug: string; display: string }) {
  validateSlug(opts.slug);
  validateDisplay(opts.display);
  const { slug, display } = opts;

  // 1. Package scope — repo-wide walk (LCD #5): package.json names, import
  //    specifiers, Dockerfile/compose references, all share the one pattern.
  for (const file of walkRepoFiles(root)) {
    rewriteFile(root, file, (c) => rewriteScope(c, OLD_SCOPE, slug));
  }

  // 2. Root package.json name field
  rewriteFile(root, "package.json", (c) => c.split(`"name": "agent-os-chassis"`).join(`"name": "${slug}"`));

  // 3. DB creds — fixed file list, bare token replace. docker/init-test-db.sql
  //    is in this list for the same reason docker-compose.yml is: it creates
  //    a database literally named "agentos_test" (adversarial-plan-review F5)
  //    — without this, the renamed .env.example's TEST_DATABASE_URL points at
  //    a database name this script never creates.
  for (const file of ["docker-compose.yml", ".env.example", "docker/init-test-db.sql", ".github/workflows/ci.yml", "apps/web/.env.example", "packages/core/test/scaffold.test.ts"]) {
    rewriteFile(root, file, (c) => rewriteToken(c, OLD_DB_TOKEN, slug));
  }

  // 4. Brand string — fixed file list
  for (const file of ["apps/web/components/shell/sidebar.tsx", "apps/web/app/layout.tsx", "README.md"]) {
    rewriteFile(root, file, (c) => rewriteToken(c, OLD_DISPLAY, display));
  }

  // 4b. Brand string, CamelCase form (no space) — fixed file list. The LLM
  //     system prompt introduces itself by this token; a bare rewriteToken
  //     pass on OLD_DISPLAY (which has a space) never matches it (Task 5
  //     review F6).
  for (const file of ["packages/core/src/engine/chat-agent.ts", "packages/core/test/scaffold.test.ts"]) {
    rewriteFile(root, file, (c) => rewriteToken(c, OLD_DISPLAY_CAMEL, display.replace(/\s+/g, "")));
  }

  console.log(`Renamed to "${slug}" / "${display}". Remaining manual steps:`);
  console.log("  1. npm install        (relinks workspace packages under the new scope)");
  console.log("  2. docker compose up  (starts postgres + web + worker)");
  console.log("  3. npm run db:migrate (applies schema to the fresh database)");
  console.log("  4. npm run seed       (creates the demo org, owner, and overdue invoice)");
  console.log("  5. set LLM_BASE_URL / LLM_API_KEY / LLM_MODEL in .env.local");
}

function parseArgs(argv: string[]): { slug: string; display: string } {
  const nameIdx = argv.indexOf("--name");
  const displayIdx = argv.indexOf("--display");
  if (nameIdx === -1 || displayIdx === -1) {
    console.error('Usage: npm run rename -- --name <slug> --display "<Display Name>"');
    process.exit(1);
  }
  return { slug: argv[nameIdx + 1]!, display: argv[displayIdx + 1]! };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { slug, display } = parseArgs(process.argv.slice(2));
  runRename(process.cwd(), { slug, display });
}
