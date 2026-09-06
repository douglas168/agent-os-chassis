import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { ApprovalCard } from "@/components/approval-card";
import messages from "@/messages/en.json";

afterEach(() => cleanup());

const action = {
  id: "a1", runId: "r1", skillId: "echo",
  draft: { to: "customer@example.com", subject: "Re: hi", body: "You said: hi" },
  editedDraft: null, status: "pending",
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  editableFields: ["subject", "body"],
};

function renderCard(overrides = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ApprovalCard action={{ ...action, ...overrides }} onDecide={vi.fn()} onEdit={vi.fn()} deciding={false} />
    </NextIntlClientProvider>,
  );
}

describe("ApprovalCard", () => {
  it("renders an input per editable field, pre-filled from the draft", () => {
    renderCard();
    expect(screen.getByLabelText("subject")).toHaveValue("Re: hi");
    expect(screen.getByLabelText("body")).toHaveValue("You said: hi");
  });

  it("calls onEdit with the edited draft when Save is clicked", async () => {
    const onEdit = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ApprovalCard action={action} onDecide={vi.fn()} onEdit={onEdit} deciding={false} />
      </NextIntlClientProvider>,
    );
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("subject"));
    await user.type(screen.getByLabelText("subject"), "New subject");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onEdit).toHaveBeenCalledWith("a1", { subject: "New subject", body: "You said: hi", to: "customer@example.com" });
  });

  it("shows a countdown derived from expiresAt", () => {
    renderCard({ expiresAt: new Date(Date.now() + 2 * 3600_000).toISOString() });
    expect(screen.getByText(/expires in/i)).toBeInTheDocument();
  });

  it("calls onDecide with the id and decision when Approve/Deny is clicked", async () => {
    const onDecide = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ApprovalCard action={action} onDecide={onDecide} onEdit={vi.fn()} deciding={false} />
      </NextIntlClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(onDecide).toHaveBeenCalledWith("a1", "approved");
  });

  it("shows non-editable draft fields as read-only text (finding 12)", () => {
    renderCard();
    expect(screen.getByText("customer@example.com")).toBeInTheDocument();
    expect(screen.queryByLabelText("to")).not.toBeInTheDocument();
  });

  it("saves a dirty edit before deciding, so Approve never ships a stale draft (finding 12)", async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ApprovalCard action={action} onDecide={onDecide} onEdit={onEdit} deciding={false} />
      </NextIntlClientProvider>,
    );
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("body"));
    await user.type(screen.getByLabelText("body"), "Edited but not saved");
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(onEdit).toHaveBeenCalledWith("a1", {
      to: "customer@example.com", subject: "Re: hi", body: "Edited but not saved",
    });
    expect(onDecide).toHaveBeenCalledWith("a1", "approved");
  });
});
