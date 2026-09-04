import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(import.meta.dirname, "../app/globals.css"), "utf-8");

describe("Ops Board design tokens", () => {
  it("defines the spec's light-mode page background", () => {
    expect(css).toContain("--background: #f6f7fb");
  });

  it("defines the spec's primary color", () => {
    expect(css).toContain("--primary: #236dc9");
  });

  it("defines the spec's 8px card radius", () => {
    expect(css).toContain("--radius: 8px");
  });

  it("defines the spec's pastel status colors", () => {
    expect(css).toContain("--danger: #f7577e");
    expect(css).toContain("--warning: #f9bf59");
    expect(css).toContain("--success: #02bc9c");
  });

  it("defines a .dark override block", () => {
    expect(css).toContain(".dark {");
  });

  it("defines a near-black pill-foreground token for solid status backgrounds", () => {
    expect(css).toContain("--pill-foreground: #111827");
  });
});

// WCAG 2.1 contrast math (relative luminance -> contrast ratio), run against
// the actual token values in globals.css so a token edit that breaks
// accessibility fails this test, not a screenshot review months later.
function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const [rl, gl, bl] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(hexA: string, hexB: string) {
  const [l1, l2] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

function extractVar(selector: string, name: string): string {
  const block = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`--${name} not found in ${selector} block`);
  return match[1];
}

function extractRootVar(name: string): string {
  return extractVar(":root", name);
}

function extractDarkVar(name: string): string {
  return extractVar("\\.dark", name);
}

describe("WCAG AA contrast (4.5:1 minimum, normal text)", () => {
  it("each solid status background meets 4.5:1 against --pill-foreground", () => {
    const pillFg = extractRootVar("pill-foreground");
    for (const status of ["danger", "warning", "success"]) {
      expect(contrastRatio(extractRootVar(status), pillFg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("light-mode --foreground meets 4.5:1 against --background", () => {
    expect(contrastRatio(extractRootVar("foreground"), extractRootVar("background"))).toBeGreaterThanOrEqual(4.5);
  });

  it("light-mode --muted-foreground meets 4.5:1 against --muted", () => {
    expect(contrastRatio(extractRootVar("muted-foreground"), extractRootVar("muted"))).toBeGreaterThanOrEqual(4.5);
  });

  it("light-mode --primary meets 4.5:1 against --primary-foreground", () => {
    expect(contrastRatio(extractRootVar("primary"), extractRootVar("primary-foreground"))).toBeGreaterThanOrEqual(4.5);
  });

  it("dark-mode solid status backgrounds meet 4.5:1 against --pill-foreground", () => {
    const pillFg = extractDarkVar("pill-foreground");
    for (const status of ["danger", "warning", "success"]) {
      expect(contrastRatio(extractDarkVar(status), pillFg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("dark-mode --foreground meets 4.5:1 against --background", () => {
    expect(contrastRatio(extractDarkVar("foreground"), extractDarkVar("background"))).toBeGreaterThanOrEqual(4.5);
  });

  it("dark-mode --muted-foreground meets 4.5:1 against --muted", () => {
    expect(contrastRatio(extractDarkVar("muted-foreground"), extractDarkVar("muted"))).toBeGreaterThanOrEqual(4.5);
  });

  it("dark-mode --primary meets 4.5:1 against --primary-foreground", () => {
    expect(contrastRatio(extractDarkVar("primary"), extractDarkVar("primary-foreground"))).toBeGreaterThanOrEqual(4.5);
  });
});
