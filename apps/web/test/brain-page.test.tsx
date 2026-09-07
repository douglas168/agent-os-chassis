import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import BrainPage from "../app/brain/page";
import messages from "../messages/en.json";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BrainPage />
    </NextIntlClientProvider>,
  );
}

describe("BrainPage", () => {
  it("renders documents, contacts, and audit history once loaded", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.startsWith("/api/documents")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{
            id: "d1",
            title: "Doc A",
            mime: "text/plain",
            sizeBytes: 10,
            createdAt: new Date().toISOString(),
          }]),
        });
      }
      if (url.startsWith("/api/brain/contacts")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: "c1", name: "Jane", company: null }]),
        });
      }
      if (url.startsWith("/api/brain/history")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: "a1", event: "action.approved", entity: "actions", createdAt: new Date().toISOString() }]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }) as unknown as typeof fetch);

    renderPage();
    await waitFor(() => expect(screen.getByText("Doc A")).toBeInTheDocument());
    expect(screen.getByText("Jane")).toBeInTheDocument();
    expect(screen.getByText("action.approved")).toBeInTheDocument();
  });

  it("filters contacts and history client-side by the search box", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.startsWith("/api/documents")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.startsWith("/api/brain/contacts")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: "c1", name: "Jane", company: null },
            { id: "c2", name: "Bob", company: null },
          ]),
        });
      }
      if (url.startsWith("/api/brain/history")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: "a1", event: "action.approved", entity: "actions", createdAt: new Date().toISOString() }]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }) as unknown as typeof fetch);

    renderPage();
    await waitFor(() => expect(screen.getByText("Jane")).toBeInTheDocument());
    expect(screen.getByText("Bob")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Search documents"), "jane");
    await waitFor(() => expect(screen.queryByText("Bob")).not.toBeInTheDocument());
    expect(screen.getByText("Jane")).toBeInTheDocument();
    expect(screen.queryByText("action.approved")).not.toBeInTheDocument();
  });
});
