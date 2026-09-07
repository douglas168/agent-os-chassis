import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import SkillsPage from "../app/skills/page";
import messages from "../messages/en.json";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SkillsPage />
    </NextIntlClientProvider>,
  );
}

describe("SkillsPage", () => {
  it("renders each skill with an enabled toggle and one input per configField", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/skills") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: "echo", name: "Echo", description: "d", hasConfig: false, configFields: [], enabled: true, config: {} },
            {
              id: "ar-reminder",
              name: "AR Reminder",
              description: "d2",
              hasConfig: true,
              configFields: [{ name: "reminderToneHint", type: "string", optional: true }],
              enabled: true,
              config: { reminderToneHint: "friendly" },
            },
          ]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch);

    renderPage();
    await waitFor(() => expect(screen.getByText("Echo")).toBeInTheDocument());

    const field = screen.getByLabelText("AR Reminder reminderToneHint") as HTMLInputElement;
    expect(field.tagName).toBe("INPUT");
    expect(field.type).toBe("text");
    expect(field.value).toBe("friendly");
    expect(screen.queryByRole("textbox", { name: /config$/i })).not.toBeInTheDocument();
  });

  it("saves an edited field as a real object, not a JSON string", async () => {
    const patchCalls: { url: string; body: string }[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/skills") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: "ar-reminder",
              name: "AR Reminder",
              description: "d2",
              hasConfig: true,
              configFields: [{ name: "reminderToneHint", type: "string", optional: true }],
              enabled: true,
              config: { reminderToneHint: "friendly" },
            },
          ]),
        });
      }
      if (init?.method === "PATCH") patchCalls.push({ url, body: String(init.body) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch);

    renderPage();
    const field = await screen.findByLabelText("AR Reminder reminderToneHint");
    await userEvent.clear(field);
    await userEvent.type(field, "formal");
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(patchCalls).toHaveLength(1));
    expect(JSON.parse(patchCalls[0].body)).toEqual({ config: { reminderToneHint: "formal" } });
  });
});
