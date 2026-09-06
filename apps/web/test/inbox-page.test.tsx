import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import InboxPage from "@/app/inbox/page";
import messages from "@/messages/zh-TW.json";

const inboxMessages = [
  {
    id: "inbox-matched",
    channel: "email",
    from: "matched@example.com",
    subject: "已配對主旨",
    body: "matched body",
    contactId: "contact-1",
    createdAt: "2026-09-06T00:00:00Z",
  },
  {
    id: "inbox-unmatched",
    channel: "email",
    from: "unknown@example.com",
    subject: null,
    body: "unmatched body",
    contactId: null,
    createdAt: "2026-09-06T00:01:00Z",
  },
];

afterEach(() => cleanup());

describe("InboxPage", () => {
  it("splits matched and unmatched messages by contactId", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(inboxMessages),
    }));

    render(
      <NextIntlClientProvider locale="zh-TW" messages={messages}>
        <InboxPage />
      </NextIntlClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "收件匣" })).toBeInTheDocument();
    const matchedSection = screen.getByRole("heading", { name: "已配對" }).closest("section");
    const unmatchedSection = screen.getByRole("heading", { name: "未配對" }).closest("section");
    expect(matchedSection).not.toBeNull();
    expect(unmatchedSection).not.toBeNull();

    expect(within(matchedSection as HTMLElement).getByText(/matched@example.com/)).toBeInTheDocument();
    expect(within(matchedSection as HTMLElement).getByText(/已配對主旨/)).toBeInTheDocument();
    expect(within(unmatchedSection as HTMLElement).getByText(/unknown@example.com/)).toBeInTheDocument();
    expect(within(unmatchedSection as HTMLElement).getByText(/\(無主旨\)/)).toBeInTheDocument();
    expect(within(matchedSection as HTMLElement).queryByText(/unknown@example.com/)).toBeNull();
    expect(within(unmatchedSection as HTMLElement).queryByText(/matched@example.com/)).toBeNull();
  });
});
