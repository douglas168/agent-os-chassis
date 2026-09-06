import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import DashboardPage from "@/app/dashboard/page";
import messages from "@/messages/zh-TW.json";

function renderPage() {
  return render(
    <NextIntlClientProvider locale="zh-TW" messages={messages}>
      <DashboardPage />
    </NextIntlClientProvider>,
  );
}

afterEach(() => cleanup());

describe("DashboardPage", () => {
  it("renders all six translated KPI labels and values", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        pendingApprovals: 2,
        actionsThisWeek: 7,
        followUpsDue: 3,
        actionsExpired: 4,
        outcomes: { approved: 5, denied: 1 },
      }),
    }));

    renderPage();

    expect(await screen.findByText("儀表板")).toBeInTheDocument();
    expect(screen.getByText("待審核")).toBeInTheDocument();
    expect(screen.getByText("本週動作")).toBeInTheDocument();
    expect(screen.getByText("待處理排程")).toBeInTheDocument();
    expect(screen.getByText("已過期動作")).toBeInTheDocument();
    expect(screen.getByText("已核准")).toBeInTheDocument();
    expect(screen.getByText("已拒絕")).toBeInTheDocument();
    for (const value of [2, 7, 3, 4, 5, 1]) {
      expect(screen.getByText(String(value))).toBeInTheDocument();
    }
  });

  it("shows a translated error state when the dashboard request is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    renderPage();

    expect(await screen.findByText("發生錯誤")).toBeInTheDocument();
  });
});
