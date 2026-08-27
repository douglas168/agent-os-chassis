import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

test("the root workspace declares all AgentOS packages", () => {
  const rootPackage = JSON.parse(
    readFileSync(resolve(repoRoot, "package.json"), "utf8"),
  ) as { workspaces?: string[] };

  assert.deepEqual(rootPackage.workspaces, ["apps/*", "packages/*"]);

  for (const packageName of ["core", "channels", "skills"]) {
    const packagePath = resolve(repoRoot, "packages", packageName, "package.json");
    assert.equal(existsSync(packagePath), true, `${packagePath} should exist`);
  }
});

test("npm links all AgentOS workspace packages", () => {
  for (const packageName of ["core", "channels", "skills"]) {
    const linkPath = resolve(repoRoot, "node_modules", "@agentos", packageName);
    assert.equal(existsSync(linkPath), true, `${linkPath} should exist`);
    assert.equal(lstatSync(linkPath).isSymbolicLink(), true, `${linkPath} should be a symlink`);
  }
});

test("the Postgres compose service accepts connections", () => {
  const output = execFileSync(
    "docker",
    ["compose", "exec", "-T", "postgres", "pg_isready", "-U", "agentos"],
    { cwd: repoRoot, encoding: "utf8" },
  );

  assert.match(output, /accepting connections/);
});
