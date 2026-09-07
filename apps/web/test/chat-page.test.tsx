import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import ChatPage from "../app/chat/page";
import messages from "../messages/en.json";

describe("ChatPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the 3-panel shell: thread list, conversation, context rail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/brain/contacts") {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([{ id: "c1", name: "Jane", company: null }]),
          });
        }
        if (url.startsWith("/api/documents")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }) as unknown as typeof fetch,
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ChatPage />
      </NextIntlClientProvider>,
    );
    await waitFor(() => expect(screen.getByText("Jane")).toBeInTheDocument());
    expect(
      screen.getByRole("region", { name: /conversation/i }),
    ).toBeInTheDocument();
  });
});
