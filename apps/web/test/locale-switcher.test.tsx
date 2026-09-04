import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import en from "@/messages/en.json";

afterEach(() => cleanup());

describe("LocaleSwitcher", () => {
  it("renders both supported locale options", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <LocaleSwitcher />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("option", { name: "English" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "繁體中文" })).toBeInTheDocument();
  });
});
