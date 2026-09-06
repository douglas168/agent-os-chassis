import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import WorkListPage from "@/app/work/page";
import messages from "@/messages/zh-TW.json";

const runs = [
  {
    id: "r-running",
    skillId: "ar-reminder",
    status: "running",
    failedStep: null,
    entityRef: null,
    createdAt: "2026-09-06T00:00:00Z",
  },
  {
    id: "r-done",
    skillId: "echo",
    status: "done",
    failedStep: null,
    entityRef: null,
    createdAt: "2026-09-05T00:00:00Z",
  },
  {
    id: "r-failed",
    skillId: "invoice-follow-up",
    status: "failed",
    failedStep: "execute",
    entityRef: null,
    createdAt: "2026-09-04T00:00:00Z",
  },
];

function renderPage() {
  return render(
    <NextIntlClientProvider locale="zh-TW" messages={messages}>
      <WorkListPage />
    </NextIntlClientProvider>,
  );
}

afterEach(() => cleanup());

describe("WorkListPage", () => {
  it("splits live and recent runs and shows the failed step", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(runs),
    }));

    renderPage();

    expect(await screen.findByRole("heading", { name: "工作" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "進行中" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "最近" })).toBeInTheDocument();
    const liveSection = screen.getByRole("heading", { name: "進行中" }).closest("section");
    const recentSection = screen.getByRole("heading", { name: "最近" }).closest("section");
    expect(liveSection).not.toBeNull();
    expect(recentSection).not.toBeNull();
    expect(within(liveSection as HTMLElement).getByText("ar-reminder")).toBeInTheDocument();
    expect(within(liveSection as HTMLElement).getByText(/running/)).toBeInTheDocument();
    expect(within(recentSection as HTMLElement).getByText("echo")).toBeInTheDocument();
    expect(within(recentSection as HTMLElement).getByText(/done/)).toBeInTheDocument();
    expect(within(recentSection as HTMLElement).getByText("invoice-follow-up")).toBeInTheDocument();
    expect(within(recentSection as HTMLElement).getByText(/於 execute 失敗/)).toBeInTheDocument();
  });
});
