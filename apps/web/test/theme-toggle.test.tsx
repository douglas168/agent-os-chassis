import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import en from "@/messages/en.json";

afterEach(() => cleanup());

describe("ThemeToggle", () => {
  it("switches the document to dark mode on click", async () => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      </NextIntlClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: /toggle theme/i }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
