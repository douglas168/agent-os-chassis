import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { RunPanel, type RunPanelData } from "../components/run-panel";
import messages from "../messages/en.json";

afterEach(() => cleanup());

const baseRun: RunPanelData = {
  id: "r1", skillId: "echo", status: "done", createdAt: new Date().toISOString(),
  conversation: [{ role: "inbound" as const, text: "hello there" }, { role: "draft" as const, text: '{"body":"hi"}' }],
  trace: [{ label: "understand", detail: { summary: "greeting" } }],
  stats: { turns: null, steps: 3, wallClockMs: 120, tokensIn: null, tokensOut: null, ttftMs: null, cacheHitRate: null },
};

function renderPanel(run = baseRun) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RunPanel run={run} />
    </NextIntlClientProvider>,
  );
}

describe("RunPanel", () => {
  it("shows the conversation by default and switches to the trace tab on click", () => {
    renderPanel();
    expect(screen.getByText("hello there")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /trace/i }));
    expect(screen.getByText("understand")).toBeInTheDocument();
  });

  it("renders the stats footer with real fields and — for unmeasured ones, including turns and ttft", () => {
    renderPanel();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("120ms")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(5);
  });

  it("renders no stats footer when stats is null", () => {
    renderPanel({ ...baseRun, stats: null });
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });
});
