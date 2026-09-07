import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import AdminUsersPage from "../app/admin/users/page";
import messages from "../messages/en.json";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AdminUsersPage />
    </NextIntlClientProvider>,
  );
}

describe("AdminUsersPage", () => {
  it("renders members and invitations, or the admin-required error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        members: [{ id: "m1", role: "owner", user: { email: "owner@example.com" } }],
        invitations: [],
      }),
    })) as unknown as typeof fetch);

    renderPage();
    await waitFor(() => expect(screen.getByText("owner@example.com")).toBeInTheDocument());
  });

  it("renders the 403 error inline when the fetch is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: "admin role required" }),
    })) as unknown as typeof fetch);

    renderPage();
    await waitFor(() => expect(screen.getByText("admin role required")).toBeInTheDocument());
  });

  it("submits the invite form and cancels a pending invitation", async () => {
    const user = userEvent.setup();
    let invitationsList: Array<{ id: string; email: string; role: string; status: string }> = [];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/admin/members" && init?.method === "POST") {
        invitationsList = [{ id: "inv-1", email: "new@example.com", role: "operator", status: "pending" }];
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve(invitationsList[0]),
        });
      }
      if (url.startsWith("/api/admin/invitations/") && init?.method === "DELETE") {
        invitationsList = [];
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          members: [{ id: "m1", role: "owner", user: { email: "owner@example.com" } }],
          invitations: invitationsList,
        }),
      });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    renderPage();
    await waitFor(() => expect(screen.getByText("owner@example.com")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText("Email address"), "new@example.com");
    await user.click(screen.getByRole("button", { name: "Invite" }));
    await waitFor(() => expect(screen.getByText(/new@example\.com/)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText(/new@example\.com/)).not.toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/members", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/invitations/inv-1", expect.objectContaining({ method: "DELETE" }));
  });
});
