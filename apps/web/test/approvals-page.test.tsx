import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import ApprovalsPage from "@/app/approvals/page";
import messages from "@/messages/zh-TW.json";

function renderPage() {
  return render(
    <NextIntlClientProvider locale="zh-TW" messages={messages}>
      <ApprovalsPage />
    </NextIntlClientProvider>,
  );
}

const pendingAction = {
  id: "a1", runId: "r1", skillId: "ar-reminder", draft: { to: "x@example.com" }, status: "pending",
};

type PatchResponse = { ok: boolean; status?: number; json: () => Promise<unknown> };

function mockFetch(patchResponse: PatchResponse | Promise<PatchResponse>, actions = [pendingAction]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return Promise.resolve(patchResponse);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(actions) });
    }),
  );
}

afterEach(() => cleanup());

describe("ApprovalsPage", () => {
  beforeEach(() => {
    mockFetch({ ok: true, json: () => Promise.resolve({}) });
  });

  it("renders the zh-TW title and approve/deny labels", async () => {
    renderPage();

    expect(await screen.findByText("待審核")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "核准" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "拒絕" })).toBeInTheDocument();
  });

  it("renders the translated empty state when there are no pending actions", async () => {
    mockFetch({ ok: true, json: () => Promise.resolve({}) }, []);
    renderPage();

    expect(await screen.findByText("目前沒有待審核項目。")).toBeInTheDocument();
  });

  it("approves an action and PATCHes the right endpoint with the right body", async () => {
    renderPage();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "核准" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/actions/a1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ decision: "approved" }),
        }),
      );
    });
  });

  it("disables both decision buttons while a decision is in flight", async () => {
    let resolvePatch!: (response: PatchResponse) => void;
    const patchResponse = new Promise<PatchResponse>((resolve) => {
      resolvePatch = resolve;
    });
    mockFetch(patchResponse);
    renderPage();

    const user = userEvent.setup();
    const approveBtn = await screen.findByRole("button", { name: "核准" });
    const denyBtn = screen.getByRole("button", { name: "拒絕" });

    await user.click(approveBtn);

    expect(approveBtn).toBeDisabled();
    expect(denyBtn).toBeDisabled();

    resolvePatch({ ok: true, json: () => Promise.resolve({}) });
  });

  it("shows an error and re-enables buttons when the PATCH fails", async () => {
    mockFetch({ ok: false, status: 500, json: () => Promise.resolve({ error: "boom" }) });
    renderPage();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "核准" }));

    expect(await screen.findByText("boom")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "核准" })).not.toBeDisabled());
  });
});
