import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { expect, test } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

test("the root workspace declares all AgentOS packages", () => {
  const rootPackage = JSON.parse(
    readFileSync(resolve(repoRoot, "package.json"), "utf8"),
  ) as { workspaces?: string[] };

  expect(rootPackage.workspaces).toEqual(["apps/*", "packages/*"]);

  for (const packageName of ["core", "channels", "skills"]) {
    const packagePath = resolve(repoRoot, "packages", packageName, "package.json");
    expect(existsSync(packagePath), `${packagePath} should exist`).toBe(true);
  }
});

test("npm links all AgentOS workspace packages", () => {
  for (const packageName of ["core", "channels", "skills"]) {
    const linkPath = resolve(repoRoot, "node_modules", "@agentos/", packageName);
    expect(existsSync(linkPath), `${linkPath} should exist`).toBe(true);
    expect(lstatSync(linkPath).isSymbolicLink(), `${linkPath} should be a symlink`).toBe(true);
  }
});

test("the configured Postgres database accepts connections", async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set for the Postgres reachability check");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<{ ok: number }>("select 1 as ok");
    expect(result.rows[0]?.ok).toBe(1);
  } finally {
    await client.end();
  }
});
