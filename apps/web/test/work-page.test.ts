import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hookHarness = vi.hoisted(() => ({
  states: [] as unknown[],
  stateIndex: 0,
  effect: null as (() => void) | null,
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = hookHarness.stateIndex++;
      if (!(index in hookHarness.states)) hookHarness.states[index] = initial;
      return [
        hookHarness.states[index],
        (value: unknown) => { hookHarness.states[index] = value; },
      ];
    },
    useEffect: (effect: () => void) => { hookHarness.effect = effect; },
  };
});

vi.mock("next/navigation", () => ({
  useParams: () => ({ entityId: "entity-1" }),
}));

import WorkEntityPage from "../app/work/[entityId]/page";
import * as React from "react";

type ElementWithChildren = { props: { children?: unknown } };

function textContent(node: unknown): string {
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (node && typeof node === "object" && "props" in node) {
    return textContent((node as ElementWithChildren).props.children);
  }
  return "";
}

const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();

describe("WorkEntityPage", () => {
  beforeEach(() => {
    hookHarness.states.length = 0;
    hookHarness.stateIndex = 0;
    hookHarness.effect = null;
    fetchMock.mockReset();
    vi.stubGlobal("React", React);
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the response error for a non-404 failure instead of mapping an invalid view", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "backend unavailable" }), { status: 500 }));

    const loading = WorkEntityPage();
    expect(textContent(loading)).toBe("Loading…");
    hookHarness.effect?.();

    await vi.waitFor(() => expect(hookHarness.states[2]).toBe("backend unavailable"));

    hookHarness.stateIndex = 0;
    const rendered = WorkEntityPage();
    expect(textContent(rendered)).toContain("Error");
    expect(textContent(rendered)).toContain("backend unavailable");
  });
});
