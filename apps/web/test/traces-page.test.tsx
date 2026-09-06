import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import TracesPage from "@/app/traces/page";
import messages from "@/messages/zh-TW.json";

const failedTrace = {
  id: "t1", skillId: "ar-reminder", status: "failed", error: "boom",
  failedStep: "draft", failedInput: { invoiceId: "inv1" }, createdAt: "2026-09-04T00:00:00Z",
};

function renderPage() {
  return render(
    <NextIntlClientProvider locale="zh-TW" messages={messages}>
      <TracesPage />
    </NextIntlClientProvider>,
  );
}

afterEach(() => cleanup());

describe("TracesPage", () => {
  it("renders the zh-TW title, a failed trace, its error, and its failed input", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([failedTrace]) }));
    renderPage();

    expect(await screen.findByText("追蹤紀錄")).toBeInTheDocument();
    expect(screen.getByText(/ar-reminder/)).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByText(/於 draft 失敗/)).toBeInTheDocument();
    expect(screen.getByText(/"invoiceId": "inv1"/)).toBeInTheDocument();
  });

  it("renders the translated empty state when there are no traces", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }));
    renderPage();

    expect(await screen.findByText("目前還沒有追蹤紀錄。")).toBeInTheDocument();
  });

  it("shows a translated error message when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve(null) }));
    renderPage();

    expect(await screen.findByText("發生錯誤")).toBeInTheDocument();
  });

  it("re-fetches with the search and status filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await user.type(screen.getByRole("searchbox", { name: "依技能搜尋…" }), "smtp");
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === "/api/traces?q=smtp")).toBe(true));

    await user.clear(screen.getByRole("searchbox", { name: "依技能搜尋…" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "狀態" }), "failed");
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === "/api/traces?status=failed")).toBe(true));
  });
});
