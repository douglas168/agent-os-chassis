import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import AdminOrgPage from "../app/admin/org/page";
import messages from "../messages/en.json";

describe("AdminOrgPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function renderPage() {
    return render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AdminOrgPage />
      </NextIntlClientProvider>,
    );
  }

  it("renders the org name field and a disabled channel-connections form", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ name: "Acme", locale: "en", channels: { email: false, line: false } }) })) as unknown as typeof fetch);

    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue("Acme")).toBeInTheDocument());
    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toBeDisabled();
  });

  it("renders real per-channel configured state from the route response (adversarial review round 1, finding 5)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ name: "Acme", locale: "en", channels: { email: true, line: false } }) })) as unknown as typeof fetch);

    renderPage();
    await waitFor(() => expect(screen.getByText(/Email: Configured/)).toBeInTheDocument());
    expect(screen.getByText(/LINE: Not configured/)).toBeInTheDocument();
  });
});
