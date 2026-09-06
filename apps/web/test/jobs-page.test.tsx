import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import JobsPage from "@/app/jobs/page";
import messages from "@/messages/zh-TW.json";

const jobs = {
  followUps: [{
    id: "f1", skillId: "ar-reminder", dueAt: "2026-09-07T08:00:00.000Z", status: "cancelled", touchIndex: 0,
  }],
  cronSkills: [{
    skillId: "ar-reminder", intervalMs: 86_400_000,
    lastRun: { status: "done", createdAt: "2026-09-06T00:00:00.000Z" },
  }],
};

afterEach(() => cleanup());

describe("JobsPage", () => {
  it("renders translated follow-up and cron state sections", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(jobs),
    }));

    render(
      <NextIntlClientProvider locale="zh-TW" messages={messages}>
        <JobsPage />
      </NextIntlClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "排程" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "待處理排程" })).toBeInTheDocument();
    const followUpsSection = screen.getByRole("heading", { name: "待處理排程" }).closest("section");
    expect(followUpsSection).not.toBeNull();
    const followUpRow = within(followUpsSection as HTMLElement).getByRole("listitem");
    expect(followUpRow).toHaveTextContent("ar-reminder");
    expect(followUpRow).toHaveTextContent("已取消");
    expect(followUpRow).not.toHaveTextContent("2026-09-07T08:00:00.000Z");
    expect(followUpRow).toHaveTextContent("到期");
    expect(screen.getByRole("heading", { name: "排程狀態" })).toBeInTheDocument();
    const cronSection = screen.getByRole("heading", { name: "排程狀態" }).closest("section");
    expect(cronSection).not.toBeNull();
    const cronRow = within(cronSection as HTMLElement).getByRole("listitem");
    expect(cronRow).toHaveTextContent("ar-reminder");
    expect(cronRow).toHaveTextContent("每 24 小時");
    expect(cronRow).toHaveTextContent("上次執行：已完成");
  });
});
