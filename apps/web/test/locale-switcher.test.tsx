import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import en from "@/messages/en.json";

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
