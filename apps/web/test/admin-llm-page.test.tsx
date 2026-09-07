import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import AdminLlmPage from "../app/admin/llm/page";
import messages from "../messages/en.json";

describe("AdminLlmPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders provider config and reports a successful test-connection result", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string, _opts?: RequestInit) => {
      if (url === "/api/admin/llm") return Promise.resolve({ ok: true, json: () => Promise.resolve({ baseUrl: "http://localhost:11434/v1", model: "qwen2.5:7b", apiKeyConfigured: true }) });
      if (url === "/api/admin/llm/test-connection") return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, detail: "HTTP 200" }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch);

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AdminLlmPage />
      </NextIntlClientProvider>,
    );
    await waitFor(() => expect(screen.getByText("http://localhost:11434/v1")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /test/i }));
    await waitFor(() => expect(screen.getByText("HTTP 200")).toBeInTheDocument());
  });
});
