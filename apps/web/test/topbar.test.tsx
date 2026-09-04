import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "@/components/theme-provider";
import { Topbar } from "@/components/shell/topbar";
import en from "@/messages/en.json";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(() => cleanup());

describe("Topbar", () => {
  it("renders global search, locale switcher, and theme toggle", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ThemeProvider>
          <Topbar />
        </ThemeProvider>
      </NextIntlClientProvider>,
    );

    const search = screen.getByRole("searchbox", { name: /global search/i });
    expect(search).toBeInTheDocument();
    // Visual-only in this plan (LCD #6) — disabled so it reads as inert,
    // not as a shipped, silently-broken control.
    expect(search).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /language/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /toggle theme/i })).toBeInTheDocument();
  });
});
