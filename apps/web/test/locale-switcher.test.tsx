import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import en from "@/messages/en.json";

function renderSwitcher() {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LocaleSwitcher />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LocaleSwitcher", () => {
  it("renders both supported locale options", () => {
    renderSwitcher();

    expect(screen.getByRole("option", { name: "English" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "繁體中文" })).toBeInTheDocument();
  });

  it("PATCHes /api/locale with the new locale on change", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ locale: "zh-TW" }) });
    vi.stubGlobal("fetch", fetchMock);
    renderSwitcher();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Language"), "zh-TW");
    expect(fetchMock).toHaveBeenCalledWith("/api/locale", { method: "PATCH", body: JSON.stringify({ locale: "zh-TW" }) });
  });
});
