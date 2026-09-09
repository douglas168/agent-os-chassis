import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

test("the Postgres compose service accepts connections", () => {
  const output = execFileSync(
    "docker",
    ["compose", "exec", "-T", "postgres", "pg_isready", "-U", "agentos"],
    { cwd: repoRoot, encoding: "utf8" },
  );

  expect(output).toMatch(/accepting connections/);
});
