import { describe, it, expect } from "vitest";
import { rewriteScope, rewriteToken, validateDisplay, validateSlug } from "./rename";

describe("rewriteScope", () => {
  it("rewrites a package scope in a package.json name field", () => {
    const input = '{\n  "name": "@agentos/core"\n}';
    expect(rewriteScope(input, "agentos", "acme-quotes")).toBe('{\n  "name": "@acme-quotes/core"\n}');
  });

  it("rewrites a package scope inside an import specifier", () => {
    const input = 'import { x } from "@agentos/core";';
    expect(rewriteScope(input, "agentos", "acme-quotes")).toBe('import { x } from "@acme-quotes/core";');
  });

  it("rewrites every occurrence in one string, including workspace dependency entries", () => {
    const input = '"dependencies": { "@agentos/core": "*", "@agentos/skills": "*" }';
    expect(rewriteScope(input, "agentos", "acme")).toBe('"dependencies": { "@acme/core": "*", "@acme/skills": "*" }');
  });

  it("leaves content with no scope match unchanged", () => {
    const input = "no scope reference here";
    expect(rewriteScope(input, "agentos", "acme")).toBe(input);
  });
});

describe("rewriteToken", () => {
  it("rewrites every bare occurrence of a token, including as a substring prefix", () => {
    const input = "POSTGRES_DB: agentos\nvolume: agentos-postgres-data";
    expect(rewriteToken(input, "agentos", "acme")).toBe("POSTGRES_DB: acme\nvolume: acme-postgres-data");
  });

  it("rewrites a connection-string with three occurrences of the token", () => {
    const input = "postgresql://agentos:agentos@localhost:5433/agentos_test";
    expect(rewriteToken(input, "agentos", "acme")).toBe("postgresql://acme:acme@localhost:5433/acme_test");
  });

  it("rewrites the CamelCase brand token separately from the spaced form", () => {
    const input = 'You are the AgentOS chat operator assistant. Not "Agent OS".';
    expect(rewriteToken(input, "AgentOS", "AcmeQuotes")).toBe('You are the AcmeQuotes chat operator assistant. Not "Agent OS".');
  });
});

describe("validateSlug", () => {
  it("accepts a valid lowercase-hyphenated slug", () => {
    expect(() => validateSlug("acme-quotes")).not.toThrow();
  });

  it("rejects uppercase, spaces, and a leading digit", () => {
    expect(() => validateSlug("Acme Quotes")).toThrow();
    expect(() => validateSlug("123-acme")).toThrow();
    expect(() => validateSlug("")).toThrow();
  });
});

describe("validateDisplay", () => {
  it("accepts a display name that is safe for generated source files", () => {
    expect(() => validateDisplay("Acme Quotes")).not.toThrow();
  });

  it("rejects empty values and quote or backslash characters", () => {
    expect(() => validateDisplay("   ")).toThrow();
    expect(() => validateDisplay('Acme "Pro"')).toThrow(/quote or backslash/);
    expect(() => validateDisplay("Acme\\Pro")).toThrow(/quote or backslash/);
  });
});
