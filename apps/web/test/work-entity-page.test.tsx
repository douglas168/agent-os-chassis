import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import WorkEntityPage from "@/app/work/[entityId]/page";
import messages from "@/messages/zh-TW.json";

vi.mock("next/navigation", () => ({
  useParams: () => ({ entityId: "inv1" }),
}));

function renderPage() {
  return render(
    <NextIntlClientProvider locale="zh-TW" messages={messages}>
      <WorkEntityPage />
    </NextIntlClientProvider>,
  );
}

afterEach(() => cleanup());

describe("WorkEntityPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: "inv1", skillId: "ar-reminder", title: "Invoice #42", subtitle: "Acme Co",
          fields: [{ label: "Amount", value: "$400" }],
          stages: [
            { key: "issued", label: "Issued" },
            { key: "due", label: "Due" },
          ],
          currentStage: "due",
          runs: [{
            id: "r1", orgId: "o1", skillId: "ar-reminder", messageId: null, mastraRunId: "m1",
            status: "completed", intent: null, entityRef: null, error: null, failedStep: null,
            failedInput: null, createdAt: "2026-09-04T00:00:00Z", updatedAt: "2026-09-04T00:00:00Z",
          }],
        }),
      }),
    );
  });

  it("renders the record, its current stage, its runs, and the zh-TW 'Runs' heading", async () => {
    renderPage();

    expect(await screen.findByText("Invoice #42")).toBeInTheDocument();
    expect(screen.getByText("Due")).toBeInTheDocument();
    expect(screen.getByText(/\$400/)).toBeInTheDocument();
    expect(screen.getByText(/completed/)).toBeInTheDocument();
    expect(screen.getByText("執行紀錄")).toBeInTheDocument();
  });

  it("renders the zh-TW loading state before the fetch resolves", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    renderPage();

    expect(screen.getByText("載入中…")).toBeInTheDocument();
  });
});
